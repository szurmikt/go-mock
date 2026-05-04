import { Injectable } from '@angular/core';
import { Platform } from '@ionic/angular';

@Injectable({
  providedIn: 'root',
})
export class PlatformService {
  constructor(private platform: Platform) {}

  get isAndroid() {
    return this.platform.is('android');
  }

  get isiOS() {
    return this.platform.is('ios');
  }
}
