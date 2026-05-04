import { inject, Injectable } from '@angular/core';
import { StorageService } from './storage.service';

@Injectable({
  providedIn: 'root',
})
export class SharedService {
  storage = inject(StorageService);

  private _navParams: {
    [key: string]: any;
  } = {};
  public rfidDisabled: boolean = false;

  constructor() {
    this.storage.getLocalData('rfidDisabled').then((setting) => {
      if (setting !== null && setting !== undefined) {
        this.rfidDisabled = setting;
      }
    });
  }

  public _setNavParams(key: string, value: any) {
    this._navParams[key] = value;
  }

  public _getNavParams(key: string = ''): any {
    if (key !== '') {
      return this._navParams[key];
    }
    return this._navParams;
  }

  public checkIsRegulaDBLoaded(input: string): boolean {
    let status = JSON.parse(input);
    return status.hasOwnProperty('success') && status.success;
  }
}
