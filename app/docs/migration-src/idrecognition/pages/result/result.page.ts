import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { CaptureSessionService } from '../../../capture/services/capture-session.service';
import { IdRecognitionService, IdRecognitionResponse } from '../../services/idrecognition.service';

type ResultState = 'loading' | 'success' | 'processing' | 'error';

interface FieldRow {
  key: string;
  label: string;
  value: string;
  confidencePct: number | null;
}

/** "dateOfBirth" -> "Date Of Birth" */
function humanizeKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

/**
 * Recognition feedback screen — calls the idrecognition Supabase Edge Function with the
 * captured image(s), shows a loading state, then renders the extracted fields (or the
 * error). A successful response with isProcessing:true means the function's 30s wait
 * budget ran out — not a failure, just unfinished, so it gets its own retry-able state.
 */
@Component({
  selector: 'app-idrecognition-result',
  templateUrl: 'result.page.html',
  styleUrls: ['result.page.scss'],
  imports: [IonContent],
})
export class ResultPage implements OnInit {
  private readonly session = inject(CaptureSessionService);
  private readonly idrecognition = inject(IdRecognitionService);
  private readonly router = inject(Router);

  readonly state = signal<ResultState>('loading');
  readonly response = signal<IdRecognitionResponse | null>(null);
  readonly rawResponse = signal('');
  readonly copied = signal(false);

  readonly fields = computed<FieldRow[]>(() => {
    const res = this.response();
    const fields = res?.summary?.fields ?? {};
    const confidences = res?.summary?.fieldConfidences ?? {};
    return Object.entries(fields)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => ({
        key,
        label: humanizeKey(key),
        value: String(value),
        confidencePct: key in confidences ? Math.round(confidences[key] * 100) : null,
      }));
  });

  async ngOnInit(): Promise<void> {
    await this.run();
  }

  async retry(): Promise<void> {
    this.state.set('loading');
    this.response.set(null);
    this.rawResponse.set('');
    await this.run();
  }

  done(): void {
    this.session.reset();
    void this.router.navigateByUrl('/capture/home');
  }

  async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.rawResponse());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1500);
    } catch {
      // Clipboard API can be denied/unavailable — button just won't show "Copied".
    }
  }

  private async run(): Promise<void> {
    const captures = Array.from(this.session.captures().values());
    try {
      const res = await this.idrecognition.submit(captures);
      this.response.set(res);
      this.rawResponse.set(JSON.stringify(res, null, 2));
      this.state.set(res.isProcessing ? 'processing' : 'success');
    } catch (err) {
      this.rawResponse.set(err instanceof Error ? err.message : String(err));
      this.state.set('error');
    }
  }
}
