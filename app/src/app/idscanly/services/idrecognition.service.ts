import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { CapturedSide } from './capture-session.service';

export interface IdRecognitionFields {
  documentType?: string;
  documentCountry?: string;
  issuingCountry?: string;
  documentNumber?: string;
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

@Injectable({ providedIn: 'root' })
export class IdRecognitionService {
  /**
   * Submit captured images to the Supabase Edge Function via raw fetch.
   * The edge function polls IdScanly internally (every 2s, up to 30s) before replying.
   * `isProcessing: true` in a successful response means the 30s budget ran out — not an error.
   */
  async submit(captures: CapturedSide[]): Promise<IdRecognitionResponse> {
    const url = `${environment.supabaseUrl}/functions/v1/idrecognition`;
    const body = {
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
      throw new Error(err instanceof Error ? err.message : 'Network error calling idrecognition');
    }

    if (!response.ok) {
      let detail = '';
      try {
        const errBody = await response.json();
        detail = errBody?.error ?? errBody?.message ?? JSON.stringify(errBody);
      } catch {
        detail = `HTTP ${response.status}`;
      }
      throw new Error(`idrecognition failed: ${detail}`);
    }

    const data: IdRecognitionResponse = await response.json();
    if (!data) {
      throw new Error('Empty response from idrecognition');
    }
    return data;
  }
}
