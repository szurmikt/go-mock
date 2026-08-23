import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { CapturedSide } from './capture-session.service';
import { AuthService } from '../../services/auth';
import { ApiEnvironmentService } from '../../services/api-environment';

export interface IdRecognitionFields {
  documentType?: string;
  // MRZ-style document code ('ID' for a national identity card, 'P' for a passport).
  // Read together with documentCountry to identify a Turkish ID — see utils/turkish-id.ts.
  documentCode?: string;
  documentCountry?: string;
  issuingCountry?: string;
  documentNumber?: string;
  // A Turkish ID card carries TWO numbers: documentNumber is the card's serial (reissued
  // with every replacement card) and identityNumber is the person's permanent TC Kimlik No,
  // which is the one SabeeApp needs. IDScanly currently returns it as `personalNumber` and
  // is renaming it to `identityNumber`; we deliberately read only the new name, so Turkish
  // scans start working the moment they ship the rename, with no app change.
  identityNumber?: string;
  fullName?: string;
  // The live idrecognition response uses `givenNames`/`surname`/`motherMaidenName`.
  // The `firstName`/`lastName`/`motherName` variants are kept as fallbacks.
  givenNames?: string;
  surname?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  placeOfBirth?: string;
  nationality?: string;
  citizenship?: string;
  sex?: string;
  gender?: string;
  motherMaidenName?: string;
  motherName?: string;
  dateOfIssue?: string;
  dateOfExpiry?: string;
  visibleDates?: string[];
  address?: string;
  // Address-card fields (documentType: 'address_card'). streetAddress is the
  // vendor's pre-combined "<street> <type> <house number>" string; streetName/
  // streetType/houseNumber are kept as a fallback if streetAddress is absent.
  city?: string;
  postalCode?: string;
  streetAddress?: string;
  streetName?: string;
  streetType?: string;
  houseNumber?: string;
  [key: string]: unknown;
}

export interface IdRecognitionResponse {
  sessionId: string;
  pid: string | null;
  isProcessing: boolean;
  status: string;
  summary: {
    isComplete: boolean;
    imageCount: number;
    successfulImageCount: number;
    failedImageCount: number;
    fields: IdRecognitionFields;
    fieldConfidences: Record<string, number>;
  };
}

/** Strips the `data:image/jpeg;base64,` prefix. */
function toBase64(dataUrl: string): string {
  return dataUrl.slice(dataUrl.indexOf(',') + 1);
}

/** Discriminates submit() failures for Mixpanel's scan_failed `reason` — see review.page.ts submit(). */
export type IdRecognitionErrorKind = 'network_error' | 'http_error' | 'empty_response';

function taggedError(message: string, kind: IdRecognitionErrorKind): Error & { kind: IdRecognitionErrorKind } {
  return Object.assign(new Error(message), { kind });
}

@Injectable({ providedIn: 'root' })
export class IdRecognitionService {
  private auth = inject(AuthService);
  private apiEnv = inject(ApiEnvironmentService);

  /**
   * Submit captured images to the Supabase Edge Function via raw fetch.
   * The edge function polls IdScanly internally (every 2s, up to 30s) before replying.
   * `isProcessing: true` in a successful response means the 30s budget ran out — not an error.
   *
   * `pid` + `sabeeToken` let the edge function validate the caller server-side
   * (a live SabeeApp session for a property that actually has IDScanly enabled)
   * instead of trusting the public Supabase anon key alone. `isTest` tells it
   * which SabeeApp API host to validate the token against — the edge function
   * picks from its own fixed live/test URLs, it never trusts a client-supplied URL.
   */
  async submit(captures: CapturedSide[]): Promise<IdRecognitionResponse> {
    const url = `${environment.supabaseUrl}/functions/v1/idrecognition`;
    const property = this.auth.selectedProperty();
    const body = {
      pid: property ? String(property.property_id) : null,
      sabeeToken: this.auth.accessToken(),
      deviceId: this.auth.deviceId(),
      isTest: this.apiEnv.isTest(),
      images: captures.map((c) => ({
        side: c.side,
        base64: toBase64(c.fullDataUrl),
        mimeType: 'image/jpeg',
      })),
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
        err instanceof Error ? err.message : 'Network error calling idrecognition',
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
      throw taggedError(`idrecognition failed: ${detail}`, 'http_error');
    }

    const data: IdRecognitionResponse = await response.json();
    if (!data) {
      throw taggedError('Empty response from idrecognition', 'empty_response');
    }
    return data;
  }
}
