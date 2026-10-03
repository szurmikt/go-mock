import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { provideRouter } from '@angular/router';
import { ManageFiltersPage } from './manage-filters.page';
import { StorageService } from '../../services/storage';
import { AuthService } from '../../services/auth';
import { FilterService } from '../../services/home-filter.service';
import { FilterTourService } from '../../services/filter-tour.service';

class FakeStorage {
  private d = new Map<string, unknown>();
  async get<T>(k: string) { return (this.d.has(k) ? this.d.get(k) : null) as T | null; }
  async set(k: string, v: unknown) { this.d.set(k, v); }
  async remove(k: string) { this.d.delete(k); }
}

describe('ManageFiltersPage tour', () => {
  it('shows the callout card', fakeAsync(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(), provideIonicAngular(), provideRouter([]),
        { provide: StorageService, useClass: FakeStorage },
        { provide: AuthService, useValue: { userId: () => 'u1' } },
      ],
    });
    const f = TestBed.createComponent(ManageFiltersPage);
    f.detectChanges();
    tick(50);
    f.detectChanges();
    const filters = TestBed.inject(FilterService).filters('u1');
    expect(filters.length).withContext('filters seeded').toBeGreaterThan(0);
    void f.componentInstance.ionViewDidEnter();
    tick(50);
    f.detectChanges();
    tick(50);
    f.detectChanges();
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelector('.onboarding-overlay')).withContext('overlay').toBeTruthy();
    expect(el.querySelector('[data-tour="new"]')).withContext('new anchor').toBeTruthy();
    expect(el.querySelector('.onboarding-callout__card')).withContext('card').toBeTruthy();
    expect(TestBed.inject(FilterTourService).seen()).toBeFalse();
  }));
});
