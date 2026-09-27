import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { markdownLiteToHtml } from '../utils/markdown-lite';

/**
 * Renders tip-card body copy (already run through `| tr`) as HTML via the app's constrained
 * markdown subset — see markdown-lite.ts. Only ever fed already-translated, app-authored
 * content (never user input), so bypassing the sanitizer here is safe: markdownLiteToHtml()
 * escapes `&`/`<`/`>` itself before inserting its own tags, so a translator typing a literal
 * "<" can't inject arbitrary markup either.
 */
@Pipe({ name: 'mdLite', standalone: true })
export class MarkdownLitePipe implements PipeTransform {
  private sanitizer = inject(DomSanitizer);

  transform(value: string | null | undefined): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(markdownLiteToHtml(value ?? ''));
  }
}
