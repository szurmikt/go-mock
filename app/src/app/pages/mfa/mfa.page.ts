import {
  Component,
  AfterViewInit,
  OnDestroy,
  ViewChildren,
  QueryList,
  ElementRef,
} from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-mfa',
  templateUrl: './mfa.page.html',
  styleUrls: ['./mfa.page.scss'],
  standalone: true,
  imports: [IonContent, TranslatePipe],
})
export class MfaPage implements AfterViewInit, OnDestroy {
  @ViewChildren('digitInput') digitInputs!: QueryList<ElementRef<HTMLInputElement>>;

  digits = ['', '', '', '', '', ''];
  loading = false;
  hasError = false;
  mfaToken = '';
  email = '';

  private timeouts: ReturnType<typeof setTimeout>[] = [];
  private t(fn: () => void, ms: number) { this.timeouts.push(setTimeout(fn, ms)); }

  constructor(
    private auth: AuthService,
    public router: Router,
  ) {
    const state = this.router.getCurrentNavigation()?.extras?.state;
    this.mfaToken = state?.['mfaToken'] ?? '';
    this.email    = state?.['email']    ?? '';
  }

  ngAfterViewInit() {
    // Delay to preserve iOS gesture context across the slide-in animation
    this.t(() => this.focusAt(0), 350);
  }

  ngOnDestroy() {
    this.timeouts.forEach(clearTimeout);
  }

  onInput(event: Event, index: number) {
    const input = event.target as HTMLInputElement;
    const val = input.value.replace(/\D/g, '').slice(-1);
    this.digits[index] = val;
    input.value = val;
    this.hasError = false;
    if (val && index < 5) this.focusAt(index + 1);
    if (val && index === 5) this.verify();
  }

  onKeydown(event: KeyboardEvent, index: number) {
    if (event.key !== 'Backspace') return;
    event.preventDefault();
    if (this.digits[index]) {
      this.digits[index] = '';
      this.inputAt(index).value = '';
    } else if (index > 0) {
      this.digits[index - 1] = '';
      this.inputAt(index - 1).value = '';
      this.focusAt(index - 1);
    }
    this.hasError = false;
  }

  onPaste(event: ClipboardEvent) {
    event.preventDefault();
    const text = event.clipboardData?.getData('text') ?? '';
    const chars = text.replace(/\D/g, '').slice(0, 6).split('');
    chars.forEach((d, i) => {
      this.digits[i] = d;
      this.inputAt(i).value = d;
    });
    this.hasError = false;
    this.focusAt(Math.min(chars.length, 5));
    if (chars.length === 6) this.verify();
  }

  async verify() {
    const code = this.digits.join('');
    if (code.length < 6 || this.loading) return;

    this.loading = true;
    this.hasError = false;
    try {
      await this.auth.verifyMfa(this.mfaToken, code, this.email);
      await this.router.navigate(['/property-select'], { replaceUrl: true });
    } catch {
      this.loading = false;
      this.hasError = true;
      this.digits = ['', '', '', '', '', ''];
      this.digitInputs.forEach(ref => (ref.nativeElement.value = ''));
      this.t(() => this.focusAt(0), 50);
    }
  }

  retryError() {
    this.hasError = false;
    this.t(() => this.focusAt(0), 50);
  }

  private focusAt(index: number) {
    this.inputAt(index)?.focus();
  }

  private inputAt(index: number): HTMLInputElement {
    return this.digitInputs?.get(index)?.nativeElement as HTMLInputElement;
  }
}
