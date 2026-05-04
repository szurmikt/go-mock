import { inject, Injectable } from '@angular/core';
import { of } from 'rxjs';
import { Storage } from '@ionic/storage-angular';

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  constructor(private storage: Storage = inject(Storage)) {
    this.storage.create().then();
  }

  /**
   * @description Save data to localStorage under the given key
   * @param key - This will be the index of data
   * @param value - Data that should be stored
   * @returns Promise
   */
  setLocalData(key: string, value: any) {
    // console.log('StorageService setLocalData key', key, 'value', value);
    return this.storage.set(key, value);
  }

  /**
   * @description Return data from localStorage by given key
   * @param key - The index of stored data
   * @returns Promise<any>
   */
  getLocalData(key: string): Promise<any> {
    // console.log('StorageService getLocalData key', key);

    // console.log('getLocalData.caller', this.getLocalData.caller);

    // Source - https://stackoverflow.com/a
    // Posted by VanagaS, modified by community. See post 'Timeline' for change history
    // Retrieved 2025-11-19, License - CC BY-SA 4.0

    // console.log(new Error().stack?.split('\n')[2]?.trim().split(' ')[1]);

    return this.storage.get(key); //Promise.resolve('asd');
  }

  /**
   * @description Clears out the whole local storage
   */
  clearLocalData() {
    return this.storage.clear();
  }

  /**
   * @description Remove one specific data from local storage by key
   * @param key - The index of data which should be deleted
   * @returns Promise<void>
   */
  removeLocalData(key: string): Promise<any> {
    return this.storage.remove(key); //Promise.resolve('asd');
  }
}
