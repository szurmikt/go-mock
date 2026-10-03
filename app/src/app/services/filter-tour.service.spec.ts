import { TestBed } from '@angular/core/testing';
import { FilterTourService } from './filter-tour.service';
import { StorageService } from './storage';

class FakeStorageService {
  private data = new Map<string, unknown>();
  async get<T>(key: string): Promise<T | null> {
    return (this.data.has(key) ? this.data.get(key) : null) as T | null;
  }
  async set(key: string, value: unknown): Promise<void> {
    this.data.set(key, value);
  }
}

describe('FilterTourService', () => {
  let service: FilterTourService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: StorageService, useClass: FakeStorageService }] });
    service = TestBed.inject(FilterTourService);
  });

  it('starts unseen, persists markSeen across a re-init, and reset clears it', async () => {
    await service.init();
    expect(service.seen()).toBeFalse();
    await service.markSeen();
    expect(service.seen()).toBeTrue();
    service.seen.set(false);
    await service.init();
    expect(service.seen()).toBeTrue();
    await service.reset();
    await service.init();
    expect(service.seen()).toBeFalse();
  });

  it('tracks the Home tour flag separately and reset clears both', async () => {
    await service.init();
    await service.markHomeSeen();
    expect(service.homeSeen()).toBeTrue();
    expect(service.seen()).toBeFalse();
    service.homeSeen.set(false);
    await service.init();
    expect(service.homeSeen()).toBeTrue();
    await service.reset();
    await service.init();
    expect(service.homeSeen()).toBeFalse();
  });
});
