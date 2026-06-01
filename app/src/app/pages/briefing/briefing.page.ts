// THROWAWAY MOCK — single-property morning-briefing prototype. Do NOT reuse anywhere; slated for removal.
//
// This is a self-contained visual prototype of the "Manager Morning Briefing" screen, enabled for a
// single property only (see briefing.const.ts). All figures are hardcoded mock data EXCEPT the manager
// first name and the hotel name, which come from AuthService. Nothing here should be reused by any other
// feature — when the prototype is dropped, delete the whole pages/briefing/ folder, the /briefing route,
// and the gated widget block in home.page.{ts,html}.

import {
  Component, OnInit, OnDestroy, AfterViewInit, inject, signal, computed, WritableSignal,
} from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonRefresher, IonRefresherContent } from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth';

interface Kpi {
  label: string;
  target: number;
  prefix: string;
  suffix: string;
  sub: string;
  trend: 'up' | 'neutral';
  display: WritableSignal<number>;
}

interface Bar { day: string; pct: number; today: boolean; }
interface Attention { id: string; severity: 'danger' | 'warning' | 'info'; title: string; detail: string; }
interface Vip { initials: string; name: string; room: string; note: string; }
interface Task { id: string; title: string; subtitle: string; done: boolean; }

@Component({
  selector: 'app-briefing',
  templateUrl: './briefing.page.html',
  styleUrls: ['./briefing.page.scss'],
  standalone: true,
  imports: [IonContent, IonRefresher, IonRefresherContent],
})
export class BriefingPage implements OnInit, AfterViewInit, OnDestroy {
  private auth = inject(AuthService);
  private router = inject(Router);

  private readonly reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  private raf = 0;
  private timeouts: ReturnType<typeof setTimeout>[] = [];

  // ── Live bits (only first name + hotel name are real) ───────────────────────
  readonly firstName = computed(() => this.auth.name().trim().split(/\s+/)[0] || 'there');
  readonly hotelName = computed(() => this.auth.selectedProperty()?.property_name || 'your hotel');
  readonly dateLabel = 'Sunday, 31 May';

  readonly headline =
    'Busy day — 22 in, 18 out, 91% full tonight. 4 things need you, month-end reports due.';

  // ── Mock data ───────────────────────────────────────────────────────────────
  readonly kpis: Kpi[] = [
    { label: 'Occupancy tonight', target: 91, prefix: '', suffix: '%', sub: '58 of 64 sold', trend: 'up', display: signal(0) },
    { label: 'ADR', target: 142, prefix: '€', suffix: '', sub: '+6% vs last yr', trend: 'up', display: signal(0) },
    { label: 'RevPAR', target: 129, prefix: '€', suffix: '', sub: '+9% vs last yr', trend: 'up', display: signal(0) },
    { label: 'Rooms left to sell', target: 6, prefix: '', suffix: '', sub: 'walk-in rate €159', trend: 'neutral', display: signal(0) },
  ];

  readonly bars: Bar[] = [
    { day: 'M', pct: 58, today: false },
    { day: 'T', pct: 52, today: false },
    { day: 'W', pct: 62, today: false },
    { day: 'T', pct: 70, today: false },
    { day: 'F', pct: 88, today: false },
    { day: 'S', pct: 96, today: true },
    { day: 'S', pct: 91, today: true },
  ];

  readonly attention: Attention[] = [
    { id: 'bal-1', severity: 'danger', title: '3 unpaid balances · €1,840', detail: 'Rooms 108, 233, 305 check out today with no card on file.' },
    { id: 'ooo-1', severity: 'warning', title: 'Overbooking risk — room 412 out of order', detail: 'Net sellable 57 vs 58 staying. One walk possible tonight.' },
    { id: 'eci-1', severity: 'info', title: '4 early check-ins (12:00–13:30)', detail: 'Only 9 rooms cleaned by noon — needs a priority order.' },
  ];

  readonly vips: Vip[] = [
    { initials: 'A&M', name: 'Anna & Marc Vogel — rm 214', room: '214', note: 'Anniversary, 4th stay. Amenity not yet assigned.' },
  ];

  // Severity → inline colours (kept out of SCSS to stay under the component-style budget).
  // Amber has no app token (app only has --success / --warn), so it's a local literal here.
  readonly flagStyle: Record<Attention['severity'], { bg: string; line: string; text: string }> = {
    danger:  { bg: 'var(--warn-soft)',        line: 'var(--warn)',         text: 'var(--warn)' },
    warning: { bg: '#fff4e0',                  line: '#f0c27a',             text: '#b26a00' },
    info:    { bg: 'var(--primary-soft-bg)',   line: 'var(--primary-soft)', text: 'var(--primary-strong)' },
  };

  readonly isMonthEnd = true;
  readonly monthEnd = {
    summary: 'Owner P&L pack, occupancy-tax filing and commission reconciliation due. Closed at 78% MTD · €131 RevPAR, 4% over budget.',
  };

  readonly tasks = signal<Task[]>([
    { id: 't1', title: 'Assign anniversary amenity — rm 214', subtitle: 'Sparkling wine + card', done: false },
    { id: 't2', title: 'Approve walk plan if oversold', subtitle: 'Partner hotel, taxi covered', done: false },
    { id: 't3', title: 'Authorise late checkout — rm 301', subtitle: 'Until 14:00', done: false },
    { id: 't4', title: 'Chase 3 unpaid balances', subtitle: '€1,840 before checkout', done: false },
  ]);

  // Bumping this remounts the animated block so CSS entry animations replay (pull-to-refresh).
  readonly revealNonce = signal(0);

  ngOnInit() {}

  ngAfterViewInit() {
    this.play();
  }

  ngOnDestroy() {
    cancelAnimationFrame(this.raf);
    this.timeouts.forEach(clearTimeout);
  }

  /** (Re)start the staggered reveal: remount sections + count KPI numbers up. */
  private play() {
    cancelAnimationFrame(this.raf);
    this.timeouts.forEach(clearTimeout);
    this.timeouts = [];

    if (this.reducedMotion) {
      this.kpis.forEach(k => k.display.set(k.target));
      this.revealNonce.update(n => n + 1);
      return;
    }

    this.kpis.forEach(k => k.display.set(0));
    this.revealNonce.update(n => n + 1);

    // Start the count-up roughly when the KPI grid finishes revealing (~2s in).
    this.timeouts.push(setTimeout(() => this.countUp(), 1900));
  }

  private countUp() {
    const dur = 1800;
    let start: number | null = null;
    const step = (ts: number) => {
      if (start === null) start = ts;
      const p = Math.min((ts - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      this.kpis.forEach(k => k.display.set(Math.round(k.target * eased)));
      if (p < 1) this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  toggleTask(id: string) {
    this.tasks.update(list =>
      list.map(t => (t.id === id ? { ...t, done: !t.done } : t)),
    );
  }

  async handleRefresh(event: CustomEvent) {
    this.play();
    (event.target as HTMLIonRefresherElement).complete();
  }

  back() {
    this.router.navigate(['/home']);
  }
}
