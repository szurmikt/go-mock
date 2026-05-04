import { inject, Injectable } from '@angular/core';

import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { StorageService } from './storage.service';
import { UserService } from './user.service';
import { ApiInterface } from '../models/api.interface';
import { LanguageService } from './languages/language.service';

@Injectable({
  providedIn: 'root',
})
export class OptionsService {
  storage = inject(StorageService);
  api = inject(ApiService);
  languageService: LanguageService = inject(LanguageService);
  userService = inject(UserService);

  options: { gender: any; document_type: any; country: any } | null = null;

  STORAGE_KEY = 'options';

  constructor() {
    // this.storage.getLocalData('options').then((data) => {
    //   if (!data || data.length == 0) {
    //     this.fetchOptions().then();
    //   } else {
    //     console.log('options from local');
    //     this.options = data;
    //   }
    // });
  }

  /** MUST be called once before using get() */
  async load(): Promise<void> {
    if (this.options) return;

    // 1️⃣ Memory
    const stored = await this.storage.getLocalData(this.STORAGE_KEY);
    if (stored) {
      this.options = stored;
      return;
    }

    // 2️⃣ API
    this.options = await this.fetchOptions();

    // 3️⃣ Cache
    await this.storage.setLocalData('options', this.options);
  }

  /** Synchronous access */
  get() {
    return this.options;
  }

  /** Optional helper */
  isLoaded(): boolean {
    console.log('OptionsService isLoaded this.options', this.options);

    return !!this.options;
  }

  /** Optional force refresh */
  async refresh(): Promise<void> {
    this.options = null;
    await this.load();
  }

  fetchOptions(): Promise<any> {
    const now = new Date();

    let observer: Observable<ApiInterface<unknown>> = this.api.get(
      'options',
      {},
    );

    return new Promise((resolve, reject) => {
      observer.subscribe({
        next: (response: any) => {
          console.log(response);
          if (!response.success) {
            reject(response.errors);
          } else {
            resolve(response.data.options);
          }
        },
        error: (error) => {
          reject(error);
        },
      });
    });
  }
}
