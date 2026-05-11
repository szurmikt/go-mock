import { Component, OnInit, OnDestroy, inject, signal, computed, ElementRef, QueryList, ViewChildren, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { LowerCasePipe } from '@angular/common';
import { IonContent, IonRefresher, IonRefresherContent } from '@ionic/angular/standalone';
import { AuthService } from '../services/auth';
import { ReservationService, pillStatus, pillLabel } from '../services/reservation';
import { OptionsService } from '../services/options.service';
import { PropertyInterface } from '../models/property.interface';
import { ReservationInterface } from '../models/reservation.interface';

type Tab = 'Yesterday' | 'Today' | 'Tomorrow';

function localDateStr(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [IonContent, IonRefresher, IonRefresherContent, LowerCasePipe],
})
export class HomePage implements OnInit, AfterViewInit, OnDestroy {
  @ViewChildren('segBtn') segBtns!: QueryList<ElementRef<HTMLButtonElement>>;

  private timeouts: ReturnType<typeof setTimeout>[] = [];
  private t(fn: () => void, ms: number) { this.timeouts.push(setTimeout(fn, ms)); }

  readonly tabs: Tab[] = ['Yesterday', 'Today', 'Tomorrow'];
  tab = signal<Tab>('Today');
  switchOpen = signal(false);
  ptrState = signal<'idle' | 'pulling' | 'refreshing'>('idle');
  pullProgress = signal(0);
  private ptrResetTimer: ReturnType<typeof setTimeout> | null = null;

  readonly pageTranslateY = computed(() => {
    if (this.ptrState() === 'idle') return 0;
    if (this.ptrState() === 'refreshing') return 80;
    return Math.min(this.pullProgress(), 1) * 80;
  });

  thumb = signal({ left: 3, width: 0 });

  readonly dateMap: Record<Tab, string> = {
    Yesterday: localDateStr(-1),
    Today: localDateStr(0),
    Tomorrow: localDateStr(1),
  };

  readonly arrivals = computed(() => {
    const date = this.dateMap[this.tab()];
    return this.res.reservations().filter(r => r.arrival_date === date);
  });

  readonly guestCount = computed(() =>
    this.arrivals().reduce((s, r) => s + r.number_of_guests, 0),
  );
  readonly totalGuests = computed(() =>
    this.res.reservations().reduce((s, r) => s + r.number_of_guests, 0),
  );
  readonly totalReservations = computed(() => this.res.reservations().length);

  private options = inject(OptionsService);

  constructor(
    public auth: AuthService,
    public res: ReservationService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.res.fetchReservations();
  }

  ngAfterViewInit() {
    this.t(() => this.updateThumb(), 50);
  }

  ngOnDestroy() {
    this.timeouts.forEach(clearTimeout);
    if (this.ptrResetTimer) clearTimeout(this.ptrResetTimer);
  }

  setTab(t: Tab) {
    this.tab.set(t);
    this.t(() => this.updateThumb(), 0);
  }

  private updateThumb() {
    const btns = this.segBtns?.toArray();
    if (!btns?.length) return;
    const idx = this.tabs.indexOf(this.tab());
    const el = btns[idx]?.nativeElement;
    if (el) this.thumb.set({ left: el.offsetLeft, width: el.offsetWidth });
  }

  async selectProperty(p: PropertyInterface) {
    if (this.auth.selectedProperty()?.property_id !== p.property_id) {
      this.options.clear();
      this.res.clear();
    }
    await this.auth.selectProperty(p);
    this.switchOpen.set(false);
    await Promise.all([
      this.res.fetchReservations(),
      this.options.countries().length === 0 ? this.options.load().catch(() => {}) : Promise.resolve(),
    ]);
  }

  onPull(event: CustomEvent) {
    if (this.ptrResetTimer) clearTimeout(this.ptrResetTimer);
    this.ptrState.set('pulling');
    (event.target as HTMLIonRefresherElement).getProgress().then(p => {
      this.pullProgress.set(Math.min(p, 1));
    });
    this.ptrResetTimer = setTimeout(() => {
      if (this.ptrState() === 'pulling') {
        this.ptrState.set('idle');
        this.pullProgress.set(0);
      }
    }, 500);
  }

  async handleRefresh(event: CustomEvent) {
    if (this.ptrResetTimer) clearTimeout(this.ptrResetTimer);
    this.ptrState.set('refreshing');
    await this.res.fetchReservations(true);
    (event.target as HTMLIonRefresherElement).complete();
    this.ptrState.set('idle');
    this.pullProgress.set(0);
  }

  goSettings() {
    this.router.navigate(['/settings']);
  }

  goSearch() {
    this.router.navigate(['/search']);
  }

  goReservation(r: ReservationInterface) {
    this.router.navigate(['/reservation', r.reservation_code]);
  }

  pillStatus = pillStatus;
  pillLabel = pillLabel;

  bookerName(r: ReservationInterface): string {
    return `${r.booker.first_name} ${r.booker.last_name}`.trim();
  }

  isDimmed(r: ReservationInterface): boolean {
    return this.tab() !== 'Today' && pillStatus(r.status) === 'open';
  }
}
