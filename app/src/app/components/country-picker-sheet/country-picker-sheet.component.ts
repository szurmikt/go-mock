import {
  AfterViewInit, Component, ElementRef, EventEmitter, Input, Output, ViewChild, computed, inject, signal,
} from '@angular/core';
import { MixpanelService } from '../../services/mixpanel';
import { CountryOption } from '../../services/options.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

/** Lower-case and strip accents, so "cote" finds "Côte d'Ivoire" and "turk" finds "Türkiye". */
function fold(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/**
 * Searchable country picker sheet — replaces the native <select> for country fields, whose iOS
 * popup list (~250 entries) has no search and no jump-to-letter. The parent renders it inside an
 * `@if` (outside ion-content, so position:fixed reaches the viewport) and removes it on `closed`.
 */
@Component({
  selector: 'app-country-picker-sheet',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './country-picker-sheet.component.html',
})
export class CountryPickerSheetComponent implements AfterViewInit {
  @Input({ required: true }) title = '';
  /** Which form field this picker edits — analytics only. */
  @Input({ required: true }) field!: 'citizenship' | 'country_code';
  @Input({ required: true }) set countries(v: CountryOption[]) { this.all.set(v); }
  /** Currently selected country_code ('' = none). */
  @Input() value = '';
  /** Most-used country codes, most popular first — shown above the full list when not searching. */
  @Input() set topCodes(v: string[]) { this.top.set(v ?? []); }

  /** Emits the picked country_code, or '' for "Clear selection". The parent closes the sheet. */
  @Output() picked = new EventEmitter<string>();
  @Output() closed = new EventEmitter<void>();

  @ViewChild('list') private list?: ElementRef<HTMLElement>;

  private mixpanel = inject(MixpanelService);
  /** Set once anything was typed in the search box during this sheet session. */
  private usedSearch = false;
  private tracked = false;

  private all = signal<CountryOption[]>([]);
  private top = signal<string[]>([]);
  query = signal('');

  /** The top codes resolved to options (unknown codes dropped), in popularity order. Hidden while searching. */
  readonly topCountries = computed(() => {
    if (this.query().trim()) return [];
    const byCode = new Map(this.all().map(c => [c.country_code, c]));
    return this.top().map(code => byCode.get(code)).filter((c): c is CountryOption => !!c);
  });

  /** Matches on name or 2-letter code; names that START with the query rank first. */
  readonly filtered = computed(() => {
    const q = fold(this.query().trim());
    const all = this.all();
    if (!q) return all;
    const starts: CountryOption[] = [];
    const contains: CountryOption[] = [];
    for (const c of all) {
      const name = fold(c.name);
      if (name.startsWith(q) || c.country_code.toLowerCase() === q) starts.push(c);
      else if (name.includes(q)) contains.push(c);
    }
    return [...starts, ...contains];
  });

  /** Opens with the current selection already in view instead of at "Afghanistan". */
  ngAfterViewInit(): void {
    if (!this.value) return;
    setTimeout(() => {
      this.list?.nativeElement.querySelector('.picker-item.selected')
        ?.scrollIntoView({ block: 'center' });
    });
  }

  onQuery(v: string): void {
    if (v.trim()) this.usedSearch = true;
    this.query.set(v);
    // A new search starts at the top of the results, not wherever the list was scrolled.
    this.list?.nativeElement.scrollTo({ top: 0 });
  }

  /** A row tap. `from` says which section it came from (the main list counts as 'search' while filtering). */
  pick(code: string, from: 'top' | 'list'): void {
    const searching = !!this.query().trim();
    this.track({
      outcome: 'picked',
      picked_from: from === 'top' ? 'top' : searching ? 'search' : 'list',
      top_rank: from === 'top' ? this.topCountries().findIndex(c => c.country_code === code) + 1 : undefined,
      changed: code !== this.value,
    });
    this.picked.emit(code);
  }

  clear(): void {
    this.track({ outcome: 'cleared', changed: !!this.value });
    this.picked.emit('');
  }

  dismiss(): void {
    this.track({ outcome: 'dismissed', changed: false });
    this.closed.emit();
  }

  private track(p: {
    outcome: 'picked' | 'cleared' | 'dismissed';
    picked_from?: 'top' | 'list' | 'search';
    top_rank?: number;
    changed: boolean;
  }): void {
    if (this.tracked) return;
    this.tracked = true;
    this.mixpanel.trackCountryPickerUsed({
      field: this.field,
      top_count: this.topCountriesUnfiltered(),
      used_search: this.usedSearch,
      query_length: this.query().trim().length,
      ...p,
    });
  }

  /** Top-section size as shown when not searching (topCountries() is empty while a query is typed). */
  private topCountriesUnfiltered(): number {
    const codes = new Set(this.all().map(c => c.country_code));
    return this.top().filter(code => codes.has(code)).length;
  }
}
