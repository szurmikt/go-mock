import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { CapturedSide } from '../../capture/services/capture-session.service';

export interface IdRecognitionFields {
  documentType?: string;
  documentCountry?: string;
  documentNumber?: string;
  fullName?: string;
  dateOfBirth?: string;
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

/** Strips the `data:image/jpeg;base64,` prefix — the function wants the raw base64 payload. */
function toBase64(dataUrl: string): string {
  return dataUrl.slice(dataUrl.indexOf(',') + 1);
}

@Injectable({ providedIn: 'root' })
export class IdRecognitionService {
  private readonly supabase: SupabaseClient = createClient(
    environment.supabaseUrl,
    environment.supabaseAnonKey,
  );

  /**
   * Single blocking call — the edge function polls IdScanly internally (every 2s, up to
   * 30s) before replying once. No polling needed here. `isProcessing: true` in a successful
   * response means the 30s budget ran out, not a failure — callers should check for that.
   */
  async submit(captures: CapturedSide[]): Promise<IdRecognitionResponse> {
    const { data, error } = await this.supabase.functions.invoke<IdRecognitionResponse>('idrecognition', {
      body: {
        images: captures.map((c) => ({
          side: c.side,
          base64: toBase64(c.fullDataUrl),
          mimeType: 'image/jpeg',
        })),
      },
    });

    if (error) {
      throw new Error(await this.describeError(error));
    }
    if (!data) {
      throw new Error('Empty response from idrecognition');
    }
    return data;
  }

  /** The function's { error, detail?, sessionId? } failure body lives on a Response
   *  object the supabase-js error exposes as `.context` — read it when present, rather
   *  than just surfacing a generic "Edge Function returned a non-2xx status code". */
  private async describeError(error: unknown): Promise<string> {
    const context = (error as { context?: Response }).context;
    if (context && typeof context.json === 'function') {
      try {
        return JSON.stringify(await context.json());
      } catch {
        // fall through
      }
    }
    return error instanceof Error ? error.message : String(error);
  }
}
