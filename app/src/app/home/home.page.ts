import { Component, OnInit, signal, computed, ElementRef, QueryList, ViewChildren, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { LowerCasePipe } from '@angular/common';
import { IonContent } from '@ionic/angular/standalone';
import { AuthService } from '../services/auth';
import { ReservationService, pillStatus, pillLabel } from '../services/reservation';
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
  imports: [IonContent, LowerCasePipe],
})
export class HomePage implements OnInit, AfterViewInit {
  @ViewChildren('segBtn') segBtns!: QueryList<ElementRef<HTMLButtonElement>>;

  readonly tabs: Tab[] = ['Yesterday', 'Today', 'Tomorrow'];
  tab = signal<Tab>('Today');
  switchOpen = signal(false);

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

  constructor(
    public auth: AuthService,
    public res: ReservationService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.res.fetchReservations();
  }

  ngAfterViewInit() {
    setTimeout(() => this.updateThumb(), 50);
  }

  setTab(t: Tab) {
    this.tab.set(t);
    setTimeout(() => this.updateThumb(), 0);
  }

  private updateThumb() {
    const btns = this.segBtns?.toArray();
    if (!btns?.length) return;
    const idx = this.tabs.indexOf(this.tab());
    const el = btns[idx]?.nativeElement;
    if (el) this.thumb.set({ left: el.offsetLeft, width: el.offsetWidth });
  }

  selectProperty(p: PropertyInterface) {
    this.auth.selectProperty(p);
    this.switchOpen.set(false);
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
