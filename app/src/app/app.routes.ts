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
    path: 'help-tips',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/help-tips/help-tips.page').then(m => m.HelpTipsPage),
  },
  {
    path: 'manage-filters',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/manage-filters/manage-filters.page').then(m => m.ManageFiltersPage),
  },
  {
    path: 'idscanly/scan',
    canActivate: [authGuard],
    loadComponent: () => import('./idscanly/pages/scan/scan.page').then(m => m.IdscanScanPage),
  },
  {
    path: 'idscanly/review',
    canActivate: [authGuard],
    loadComponent: () => import('./idscanly/pages/review/review.page').then(m => m.IdscanReviewPage),
  },
  {
    path: 'update-required',
    loadComponent: () =>
      import('./pages/update-required/update-required.page').then(m => m.UpdateRequiredPage),
  },
  {
    path: 'go-unavailable',
    loadComponent: () =>
      import('./pages/go-unavailable/go-unavailable.page').then(m => m.GoUnavailablePage),
  },
  {
    path: 'service-unavailable',
    loadComponent: () =>
      import('./pages/service-unavailable/service-unavailable.page').then(m => m.ServiceUnavailablePage),
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
];
