import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.page').then(m => m.LoginPage),
  },
  {
    path: 'mfa',
    loadComponent: () => import('./pages/mfa/mfa.page').then(m => m.MfaPage),
  },
  {
    path: 'property-select',
    loadComponent: () =>
      import('./pages/property-select/property-select.page').then(m => m.PropertySelectPage),
  },
  {
    path: 'home',
    canActivate: [authGuard],
    loadComponent: () => import('./home/home.page').then(m => m.HomePage),
  },
  {
    path: 'search',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/search/search.page').then(m => m.SearchPage),
  },
  {
    path: 'reservation/:code',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/reservation-detail/reservation-detail.page').then(m => m.ReservationDetailPage),
  },
  {
    path: 'guest/:code/:guestId',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/guest-detail/guest-detail.page').then(m => m.GuestDetailPage),
  },
  {
    path: 'guest/:code/:guestId/edit',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/guest-edit/guest-edit.page').then(m => m.GuestEditPage),
  },
  {
    path: 'settings',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/settings/settings.page').then(m => m.SettingsPage),
  },
  {
    path: 'guest/:code/:guestId/scan',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/id-scan/id-scan.page').then(m => m.IdScanPage),
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
];
