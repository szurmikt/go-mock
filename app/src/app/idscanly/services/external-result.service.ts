import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth';
import { ApiEnvironmentService } from '../../services/api-environment';
import * as Sentry from '@sentry/angular';
import { GuestInterface } from '../../models/guest.interface';
import { toIdscanlyFields } from '../utils/to-idscanly-fields';

/** Discriminates submit() failures, mirroring IdRecognitionService's taggedError(). */
export type ExternalResultErrorKind = 'network_error' | 'http_error';

function taggedError(
  message: string,
  kind: ExternalResultErrorKind,
): Error & { kind: ExternalResultErrorKind } {
  return Object.assign(new Error(message), { kind });
}

@Injectable({ providedIn: 'root' })
export class ExternalResultService {
  private auth = inject(AuthService);
  private apiEnv = inject(ApiEnvironmentService);

  /**
   * Fire-and-forget entry point used by the two save sites (guest-detail's save-as-is and
   * guest-edit's save-after-edit). Never rejects and never throws: the guest has already
   * been saved successfully by the time this runs, and a background quality signal must
   * never disturb that flow. Failures go to Sentry rather than the user — without that,
   * a broken Edge Function would mean IDScanly silently receives nothing forever.
   *
   * No-ops unless the scan actually came from IDScanly (Regula sets no sessionId).
   */
  submitInBackground(
    sessionId: string | undefined,
    guest: GuestInterface,
    isIdentityDocument: boolean,
  ): void {
    if (!sessionId) return;
    this.submit(sessionId, toIdscanlyFields(guest, isIdentityDocument)).catch(err => {
      Sentry.captureException(err, {
        tags: {
          context: 'idscanly_external_result',
          kind: (err as { kind?: string })?.kind ?? 'error',
        },
      });
    });
  }

  /**
   * Post the final, user-confirmed scan values back to IDScanly, attached to the session
   * that produced them. IDScanly stores this separately from its own OCR result and uses
   * it to measure/improve extraction accuracy — it never affects our guest data.
   *
   * Goes through a Supabase Edge Function rather than calling IDScanly directly: the
   * IDScanly API key must stay server-side (see docs/external-result-handoff.md), exactly
   * like the `idrecognition` proxy. `pid` + `sabeeToken` + `deviceId` + `isTest` let that
   * function validate the caller server-side (a live SabeeApp session for a property that
   * actually has IDScanly enabled) instead of trusting the public Supabase anon key alone.
   *
   * Throws on failure. Callers treat this as fire-and-forget and swallow the rejection —
   * this is a background quality signal and must never disturb the guest-save flow.
   */
  async submit(sessionId: string, result: Record<string, unknown>): Promise<void> {
    const url = `${environment.supabaseUrl}/functions/v1/external-result`;
    const property = this.auth.selectedProperty();
    const body = {
      pid: property ? String(property.property_id) : null,
      sabeeToken: this.auth.accessToken(),
      deviceId: this.auth.deviceId(),
      isTest: this.apiEnv.isTest(),
      sessionId,
      result,
    };

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${environment.supabaseAnonKey}`,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw taggedError(
        err instanceof Error ? err.message : 'Network error calling external-result',
        'network_error',
      );
    }

    if (!response.ok) {
      let detail = '';
      try {
        const errBody = await response.json();
        detail = errBody?.error ?? errBody?.message ?? JSON.stringify(errBody);
      } catch {
        detail = `HTTP ${response.status}`;
      }
      throw taggedError(`external-result failed: ${detail}`, 'http_error');
    }
  }
}
