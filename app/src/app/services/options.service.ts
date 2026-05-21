import { Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api';

export interface CountryOption {
  id: number;
  name: string;
  country_code: string;
}

export interface SelectOption {
  value: string;
  label: string;
}

interface OptionsApiResponse {
  success: boolean;
  data: {
    options: {
      country: CountryOption[];
      document_type?: Record<string, string>;
      gender?: Record<string, string>;
    };
  };
}

@Injectable({ providedIn: 'root' })
export class OptionsService {
  readonly countries = signal<CountryOption[]>([]);
  readonly documentTypes = signal<SelectOption[]>([]);
  readonly genders = signal<SelectOption[]>([]);

  constructor(private api: ApiService) {}

  async load(): Promise<void> {
    const r = await firstValueFrom(this.api.get<OptionsApiResponse>('options'));
    this.countries.set(r.data.options.country);
    this.documentTypes.set(
      Object.entries(r.data.options.document_type ?? {}).map(([value, label]) => ({ value: value.toLowerCase(), label })),
    );
    this.genders.set(
      Object.entries(r.data.options.gender ?? {}).map(([value, label]) => ({ value: value.toLowerCase(), label })),
    );
  }

  clear(): void {
    this.countries.set([]);
    this.documentTypes.set([]);
    this.genders.set([]);
  }
}
