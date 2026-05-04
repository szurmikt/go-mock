import { Routes } from '@angular/router';
import { AuthGuard } from './services/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'dashboard',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./pages/dashboard/dashboard.page').then((m) => m.DashboardPage),
  },
  {
    path: 'settings',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./pages/settings/settings.page').then((m) => m.SettingsPage),
  },
  {
    path: 'reservations',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./pages/reservations/reservations.page').then(
        (m) => m.ReservationsPage,
      ),
  },
  {
    path: 'arrivals',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./pages/arrivals/arrivals.page').then((m) => m.ArrivalsPage),
  },
  {
    path: 'departures',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./pages/departures/departures.page').then(
        (m) => m.DeparturesPage,
      ),
  },
  {
    path: 'reservation/:reservationCode',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./pages/reservation/reservation.page').then(
        (m) => m.ReservationPage,
      ),
  },
  {
    path: 'guest/:reservationCode/:reservationGuestId',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./pages/guest/guest.page').then((m) => m.GuestPage),
  },
  {
    path: 'guest/:reservationCode/:reservationGuestId/edit',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./pages/guestedit/guestedit.page').then((m) => m.GuestEditPage),
  },
  {
    path: 'idscan',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./pages/idscan/idscan.page').then((m) => m.IdScanPage),
  },
  {
    path: 'guestfeedback',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./pages/guest-feedback/guest-feedback.page').then(
        (m) => m.GuestFeedbackPage,
      ),
  },
  {
    path: 'reader',
    loadComponent: () =>
      import('./pages/document-reader/document-reader.component').then(
        (m) => m.DocumentReaderComponent,
      ),
    pathMatch: 'full',
  },
  {
    path: 'splash',
    loadComponent: () =>
      import('./pages/splash/splash.page').then((m) => m.SplashPage),
  },
  {
    path: '',
    loadComponent: () =>
      import('./pages/splash/splash.page').then((m) => m.SplashPage),
    pathMatch: 'full',
  },
];
