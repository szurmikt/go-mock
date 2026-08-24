import { Injectable, inject } from '@angular/core';
import * as Sentry from '@sentry/angular';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth';
import { AppVersionService } from '../../services/app-version';
import { ApiEnvironmentService } from '../../services/api-environment';
import { PropertyConfigService } from '../../services/property-config.service';
import { GuestInterface, ScanResultInterface } from '../../models/guest.interface';
import { toIdscanlyFields } from '../utils/to-idscanly-fields';

/** Discriminates submit() failures, mirroring IdRecognitionService's taggedError(). */
export type ExternalResultErrorKind = 'network_error' | 'http_error';

function taggedError(
  message: string,
  kind: ExternalResultErrorKind,
): Error & { kind: ExternalResultErrorKind } {
  return Object.assign(new Error(message), { kind });
}

/** Size-caps a JSON blob for a Sentry log attribute — same convention as
 *  review.page.ts's logIdscanlyResponse(). */
function capJson(value: unknown): string {
  const json = JSON.stringify(value ?? null);
  return json.length > 16000
    ? `${json.slice(0, 16000)}…[truncated ${json.length} chars]`
    : json;
}

@Injectable({ providedIn: 'root' })
export class ExternalResultService {
  private auth = inject(AuthService);
  private appVersion = inject(AppVersionService);
  private apiEnv = inject(ApiEnvironmentService);
  private propertyConfig = inject(PropertyConfigService);

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
    reservationCode: string,
    isIdentityDocument: boolean,
    documentNumberKey?: ScanResultInterface['documentNumberKey'],
  ): void {
    if (!sessionId) return;
    const fields = toIdscanlyFields(guest, isIdentityDocument, documentNumberKey);
    this.submit(sessionId, fields)
      .then(response =>
        this.logOutcome(sessionId, reservationCode, guest.guest_id, isIdentityDocument, fields, response, null),
      )
      .catch(err => {
        this.logOutcome(sessionId, reservationCode, guest.guest_id, isIdentityDocument, fields, null, err);
        const propertyId = this.auth.selectedProperty()?.property_id ?? 'unknown';
        Sentry.captureException(err, {
          tags: {
            context: 'idscanly_external_result',
            kind: (err as { kind?: string })?.kind ?? 'error',
            property_id: String(propertyId),
            reservation_code: reservationCode,
            guest_id: guest.guest_id,
            app_version: this.appVersion.version(),
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
   * Resolves with the Edge Function's parsed response (which wraps IDScanly's own, incl.
   * `imageCount`). Throws on failure — callers treat this as fire-and-forget and swallow
   * the rejection, since this is a background quality signal.
   */
  async submit(sessionId: string, result: Record<string, unknown>): Promise<unknown> {
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

    return await response.json().catch(() => null);
  }

  /**
   * Console + Sentry Logs dump of exactly what we sent and what came back — gated on the
   * CURRENT property's `extended_logging` flag (property_config), never unconditional,
   * mirroring review.page.ts's logIdscanlyResponse(). The sent payload is guest PII (name,
   * DOB, document number), so logging it for every property would leak that into Sentry via
   * breadcrumbs on any unrelated error; opt-in per property keeps it off by default.
   *
   * `image_count` is pulled out as its own attribute because it is the one value that
   * distinguishes a real success from a silent one: a 200 with `imageCount: 0` means
   * IDScanly matched the session but attached the result to nothing.
   */
  private logOutcome(
    sessionId: string,
    reservationCode: string,
    guestId: string,
    isIdentityDocument: boolean,
    sent: Record<string, unknown>,
    response: unknown,
    error: unknown,
  ): void {
    if (!this.propertyConfig.extendedLogging()) return;

    const propertyId = this.auth.selectedProperty()?.property_id ?? 'unknown';
    const idscanly = (response as { idscanly?: { imageCount?: number; success?: boolean } } | null)
      ?.idscanly;

    console.log(
      '[idscanly] external-result:',
      error ? 'FAILED' : 'ok',
      'session:',
      sessionId,
      'sent:',
      sent,
      'response:',
      response,
      error ?? '',
    );

    Sentry.logger.info(`idscanly external-result pid=${propertyId} code=${reservationCode}`, {
      session_id: sessionId,
      ok: !error,
      is_identity_document: isIdentityDocument,
      image_count: Number(idscanly?.imageCount ?? -1),
      idscanly_success: !!idscanly?.success,
      error_kind: String((error as { kind?: string })?.kind ?? ''),
      error_message: error instanceof Error ? error.message : '',
      sent_json: capJson(sent),
      response_json: capJson(response),
      property_id: String(propertyId),
      reservation_code: reservationCode,
      guest_id: guestId,
      app_version: this.appVersion.version(),
    });
  }
}
