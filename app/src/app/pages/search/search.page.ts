import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef, Signal, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs/operators';
import { ReservationService, pillStatus, pillLabel } from '../../services/reservation';
import { StorageService } from '../../services/storage';
import { Config } from '../../config/config';
import { ReservationInterface } from '../../models/reservation.interface';

@Component({
  selector: 'app-search',
  templateUrl: './search.page.html',
  styleUrls: ['./search.page.scss'],
  standalone: true,
  imports: [IonContent, FormsModule],
})
export class SearchPage implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('searchInput') searchInputRef!: ElementRef<HTMLInputElement>;

  query = signal('');
  recentSearches = signal<string[]>([]);

  private debouncedQuery!: Signal<string>;
  private timeouts: ReturnType<typeof setTimeout>[] = [];
  private t(fn: () => void, ms: number) { this.timeouts.push(setTimeout(fn, ms)); }

  readonly results = computed(() => {
    const q = (this.debouncedQuery() ?? '').trim().toLowerCase();
    if (q.length < 3) return [];
    const today = new Date().toISOString().slice(0, 10);
    return this.res.reservations()
      .filter(r => {
        const code  = r.reservation_code.toLowerCase();
        const first = (r.booker.first_name ?? '').toLowerCase();
        const last  = (r.booker.last_name  ?? '').toLowerCase();
        const email = (r.booker.email      ?? '').toLowerCase();
        return code.startsWith(q) ||
          first.split(' ').some(w => w.startsWith(q)) ||
          last.split(' ').some(w => w.startsWith(q)) ||
          `${first} ${last}`.startsWith(q) ||
          email.includes(q);
      })
      .sort((a, b) => {
        const dist = (d: string) =>
          d < today ? today.localeCompare(d) : d.localeCompare(today);
        const da = dist(a.arrival_date);
        const db = dist(b.arrival_date);
        if (da !== db) return da < db ? -1 : 1;
        return a.arrival_date >= today ? -1 : 1;
      });
  });

  pillStatus = pillStatus;
  pillLabel = pillLabel;

  constructor(
    private res: ReservationService,
    private storage: StorageService,
    private router: Router,
  ) {
    this.debouncedQuery = toSignal(
      toObservable(this.query).pipe(debounceTime(200)),
      { initialValue: '' },
    );
  }

  async ngOnInit() {
    if (this.res.reservations().length === 0) {
      this.res.fetchReservations();
    }
    const history = await this.storage.get<string[]>(Config.STORAGE_SEARCH_HISTORY_KEY);
    if (history?.length) this.recentSearches.set(history);
  }

  ngAfterViewInit() {
    this.t(() => this.searchInputRef?.nativeElement.focus(), 100);
  }

  ngOnDestroy() {
    this.timeouts.forEach(clearTimeout);
  }

  setQuery(value: string) {
    this.query.set(value);
  }

  clearQuery() {
    this.query.set('');
    this.t(() => this.searchInputRef?.nativeElement.focus(), 50);
  }

  onEnter() {
    const term = this.query().trim();
    if (term.length >= 3) this.saveSearch(term);
  }

  async goReservation(r: ReservationInterface) {
    await this.saveSearch(this.query().trim());
    this.router.navigate(['/reservation', r.reservation_code]);
  }

  back() {
    window.history.back();
  }

  bookerName(r: ReservationInterface): string {
    return `${r.booker.first_name} ${r.booker.last_name}`.trim();
  }

  private async saveSearch(term: string) {
    if (term.length < 3) return;
    const updated = [term, ...this.recentSearches().filter(t => t !== term)].slice(0, 10);
    this.recentSearches.set(updated);
    await this.storage.set(Config.STORAGE_SEARCH_HISTORY_KEY, updated);
  }
}
