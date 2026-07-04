import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'capture/home',
    loadComponent: () =>
      import('./capture/pages/home/home.page').then((m) => m.HomePage),
  },
  {
    path: 'capture/scan',
    loadComponent: () =>
      import('./capture/pages/scan/scan.page').then((m) => m.ScanPage),
  },
  {
    path: 'capture/review',
    loadComponent: () =>
      import('./capture/pages/review/review.page').then((m) => m.ReviewPage),
  },
  {
    path: 'idrecognition/result',
    loadComponent: () =>
      import('./idrecognition/pages/result/result.page').then((m) => m.ResultPage),
  },
  {
    path: '',
    redirectTo: 'capture/home',
    pathMatch: 'full',
  },
];
