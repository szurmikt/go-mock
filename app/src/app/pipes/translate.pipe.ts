import { inject, Pipe, PipeTransform } from '@angular/core';
import { LanguageService } from '../services/language.service';

@Pipe({ name: 'tr', standalone: true, pure: false })
export class TranslatePipe implements PipeTransform {
  private lang = inject(LanguageService);

  transform(key: string, params?: Record<string, string | number>): string {
    const dotIndex = key.indexOf('.');
    if (dotIndex === -1) return key;

    const ns = key.slice(0, dotIndex);
    const prop = key.slice(dotIndex + 1);
    const map = this.lang.translations();
    let text = map?.[ns]?.[prop] ?? key;

    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(`{{${k}}}`, String(v));
      }
    }

    return text;
  }
}
