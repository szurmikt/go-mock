import { Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api';

export interface CountryOption {
  id: number;
  name: string;
  country_code: string;
}

interface OptionsApiResponse {
  success: boolean;
  data: {
    options: {
      country: CountryOption[];
    };
  };
}

@Injectable({ providedIn: 'root' })
export class OptionsService {
  readonly countries = signal<CountryOption[]>([]);

  constructor(private api: ApiService) {}

  async load(): Promise<void> {
    const countries = await firstValueFrom(
      this.api.get<OptionsApiResponse>('options').pipe(map(r => r.data.options.country)),
    );
    this.countries.set(countries);
  }

  clear(): void {
    this.countries.set([]);
  }
}
