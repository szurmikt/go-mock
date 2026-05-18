import { inject, Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

import { Device, DeviceId, DeviceInfo } from '@capacitor/device';

import { ApiService } from '../api';
import { StorageService } from '../storage';
// import { ApiInterface } from '../../models/api.interface';
import { TRANSLATIONS } from './translations';

@Injectable({
  providedIn: 'root',
})
export class LanguageService {
  storage = inject(StorageService);
  api = inject(ApiService);

  STORAGE_KEY_LANGUAGE = 'language';
  STORAGE_KEY_LANGUAGES = 'languages';
  STORAGE_KEY_TRANSLATIONS = 'translations';

  _translations: any | null = {};
  _languages: any[] = [];

  _deviceLanguage: any;
  _currentLanguage: string | null = null;

  public languagesBS: BehaviorSubject<any> = new BehaviorSubject<any>(
    this._languages,
  );

  public translationBS: BehaviorSubject<any> = new BehaviorSubject<any>(
    TRANSLATIONS,
  );
  translations$ = this.translationBS.asObservable();

  constructor() {}

  onReady(): Promise<any> {
    if (
      this._deviceLanguage &&
      this._translations &&
      this._languages.length > 0 &&
      this._currentLanguage != ''
    ) {
      return new Promise(async (resolve) => {
        resolve(true);
      });
    }
    return new Promise(async (resolve) => {
      this._deviceLanguage = (await Device.getLanguageCode()).value;
      this._deviceLanguage =
        String(this._deviceLanguage).charAt(0).toUpperCase() +
        String(this._deviceLanguage).slice(1);
      console.log('this._deviceLanguage', this._deviceLanguage);
      const storedLanguage = await this.storage.get(this.STORAGE_KEY_LANGUAGE);
      this._currentLanguage = storedLanguage ?? this._deviceLanguage;
      await this.fetchLanguages();

      resolve(true);
    });
  }

  async loadLanguageData(): Promise<void> {
    console.log('loadLanguageData called');

    this._deviceLanguage = (await Device.getLanguageCode()).value;
    this._deviceLanguage =
      String(this._deviceLanguage).charAt(0).toUpperCase() +
      String(this._deviceLanguage).slice(1);
    console.log('this._deviceLanguage', this._deviceLanguage);

    if (
      this._translations &&
      this._languages.length > 0 &&
      this._currentLanguage != ''
    )
      return;
    console.log('loadLanguageData direct prop failed');

    const storedLanguage = await this.storage.get<string>(
      this.STORAGE_KEY_LANGUAGE,
    );
    const storedLanguages = await this.storage.get<any[]>(
      this.STORAGE_KEY_LANGUAGES,
    );
    const storedTranslations = await this.storage.get(
      this.STORAGE_KEY_TRANSLATIONS,
    );
    if (
      storedLanguages &&
      storedLanguages.length > 0 &&
      storedTranslations &&
      storedLanguage
    ) {
      this._translations = storedTranslations;
      this._languages = storedLanguages;
      this._currentLanguage = storedLanguage;
      console.log('loadLanguageData storedLanguage', storedLanguage);

      this.languagesBS.next(this._languages);
      this.translationBS.next(this._translations);
      return;
    }
    console.log('loadLanguageData localstorage failed');

    await this.fetchLanguages();
  }

  get translations(): any {
    // console.log('get translations this._translations', this._translations);

    return this._translations;
  }

  getTranslation(group: string, key: string) {
    return this._translations[group]?.[key] || '';
  }

  get languages() {
    return this._languages;
  }

  get currentLanguage() {
    console.log(
      'LanguageService get currentLanguage this._currentLanguage',
      this._currentLanguage,
      ' this._deviceLanguage',
      this._deviceLanguage,
    );

    return this._currentLanguage ?? this._deviceLanguage;
  }

  set currentLanguage(lang: string) {
    this._currentLanguage = lang;
    this.storage
      .set(this.STORAGE_KEY_LANGUAGE, this._currentLanguage)
      .then((_) => {});
    this.fetchLanguages();
  }

  fetchLanguages(): Promise<any> {
    let observer: Observable<any> = this.api.get('languages', {
      lang: this.currentLanguage,
    });

    return new Promise((resolve, reject) => {
      observer.subscribe({
        next: (response: any) => {
          console.log(response);

          if (!response.success) {
            reject(response.errors);
          } else {
            this._languages = response.data.languages;

            this._translations = this.mergeTranslations(
              TRANSLATIONS,
              response.data.translations,
            );
            this.storage
              .set(this.STORAGE_KEY_LANGUAGES, this._languages)
              .then((_) => {});
            this.storage
              .set(this.STORAGE_KEY_TRANSLATIONS, this._translations)
              .then((_) => {});

            this.translationBS.next(this._translations);
            this.languagesBS.next(this._languages);
            resolve(true);
          }
        },
        error: (error) => {
          reject(error);
        },
      });
    });
  }

  mergeTranslations(
    fallback: any,
    translations: any,
  ): { [key: string]: { [key: string]: string } } {
    const merged: any = { ...fallback };

    for (const group in translations) {
      if (!merged[group]) {
        merged[group] = {};
      }
      for (const key in translations[group]) {
        merged[group][key] = translations[group][key];
      }
    }

    return merged;
  }

  isLoaded() {
    return (
      this._translations &&
      this._languages &&
      this._languages.length > 0 &&
      this._currentLanguage
    );
  }
}
