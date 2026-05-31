import {
  Component,
  ElementRef,
  QueryList,
  ViewChildren,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth';
import { SupabaseService } from '../../services/supabase';
import { Config } from '../../config/config';

type Segment = 'feature_request' | 'feedback';
type Mode = 'form' | 'success';

@Component({
  selector: 'app-feedback-sheet',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './feedback-sheet.component.html',
})
export class FeedbackSheetComponent {
  @ViewChildren('segBtn') segBtns!: QueryList<ElementRef<HTMLButtonElement>>;

  private auth = inject(AuthService);
  private supabase = inject(SupabaseService);

  readonly segments: { key: Segment; label: string }[] = [
    { key: 'feature_request', label: 'Feature Request' },
    { key: 'feedback', label: 'Feedback' },
  ];

  visible = signal(false);
  mode = signal<Mode>('form');
  segment = signal<Segment>('feature_request');
  text = signal('');
  submitting = signal(false);
  error = signal<string | null>(null);
  thumb = signal({ left: 3, width: 0 });

  readonly title = computed(() =>
    this.segment() === 'feature_request' ? 'Request a Feature' : 'Feedback',
  );
  readonly placeholder = computed(() =>
    this.segment() === 'feature_request'
      ? 'What would you like the app to do?'
      : "What's on your mind?",
  );
  readonly canSubmit = computed(
    () => this.text().trim().length > 0 && !this.submitting(),
  );

  open() {
    this.mode.set('form');
    this.segment.set('feature_request');
    this.text.set('');
    this.error.set(null);
    this.submitting.set(false);
    this.visible.set(true);
    setTimeout(() => this.updateThumb(), 50);
  }

  close() {
    this.visible.set(false);
  }

  setSegment(s: Segment) {
    this.segment.set(s);
    setTimeout(() => this.updateThumb(), 0);
  }

  private updateThumb() {
    const btns = this.segBtns?.toArray();
    if (!btns?.length) return;
    const idx = this.segments.findIndex(s => s.key === this.segment());
    const el = btns[idx]?.nativeElement;
    if (el) this.thumb.set({ left: el.offsetLeft, width: el.offsetWidth });
  }

  async submit() {
    if (!this.canSubmit()) return;
    this.submitting.set(true);
    this.error.set(null);

    const property = this.auth.selectedProperty();
    const row = {
      type: this.segment(),
      content: this.text().trim(),
      user_id: this.auth.userId(),
      user_name: this.auth.name(),
      user_email: this.auth.email(),
      property_id: String(property?.property_id ?? ''),
      property_name: property?.property_name ?? '',
      app_version: Config.APP_VERSION,
    };

    try {
      const { error } = await this.supabase.db.from('feedback').insert(row);
      if (error) throw error;
      this.mode.set('success');
    } catch {
      this.error.set('Could not send right now. Please try again.');
    } finally {
      this.submitting.set(false);
    }
  }
}
