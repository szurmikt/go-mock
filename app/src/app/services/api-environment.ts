import { Injectable, signal, computed } from '@angular/core';
import { environment } from '../../environments/environment';
import { Config } from '../config/config';
import { StorageService } from './storage';

export type ApiEnvMode = 'live' | 'test';

@Injectable({ providedIn: 'root' })
export class ApiEnvironmentService {
  private _mode = signal<ApiEnvMode>('live');
  readonly mode = this._mode.asReadonly();
  readonly isTest = computed(() => this._mode() === 'test');
  readonly apiUrl = computed(() =>
    this._mode() === 'test' ? environment.testApiUrl : environment.apiUrl,
  );

  constructor(private storage: StorageService) {}

  async init(): Promise<void> {
    const stored = await this.storage.get<ApiEnvMode>(Config.STORAGE_API_ENV_KEY);
    if (stored === 'test' || stored === 'live') {
      this._mode.set(stored);
    }
  }

  async setMode(mode: ApiEnvMode): Promise<void> {
    this._mode.set(mode);
    await this.storage.set(Config.STORAGE_API_ENV_KEY, mode);
  }
}
