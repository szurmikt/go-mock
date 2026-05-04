/** angular */
import { inject, Injectable } from '@angular/core';

/** ionic */
import { LoadingController } from '@ionic/angular';
import { ModalController } from '@ionic/angular/standalone';
import { InfoModalInterface } from '../models/info-modal.interface';
import { InfoModalComponent } from '../components/info-modal/info-modal.component';

@Injectable({
  providedIn: 'root',
})
export class ModalService {
  private _modalOpened: boolean = false;

  constructor(
    private modalCtrl: ModalController = inject(ModalController),
    private loadingCtrl: LoadingController,
  ) {}

  /**
   * @description Open modal, if there was modal previously opened close it first than open new one.
   * @params component Component which holds template you want to display. Defined in components/modals/<modal-name>.
   * @params componentProps Additional data that is required for component to work properly.
   */
  public async openModal(options: any) {
    console.log('ModalService openModal this._modalOpened', this._modalOpened);
    if (this._modalOpened) {
      this.modalCtrl.dismiss().then((_) => {
        this._modalOpened = false;
      });
    }
    const modal = await this.modalCtrl.create(options);
    await modal.present().then((_) => {
      this._modalOpened = true;
      console.log(
        'ModalService modal.present() this._modalOpened',
        this._modalOpened,
      );
    });

    await modal.onDidDismiss().then((_) => {
      this._modalOpened = false;
      console.log(
        'ModalService modal.onDidDismiss() this._modalOpened',
        this._modalOpened,
      );
    });
  }

  /**
   * @description Close modal
   */
  public async closeModal() {
    console.log('ModalService closeModal this._modalOpened', this._modalOpened);
    if (this._modalOpened) {
      await this.modalCtrl.dismiss().then((_) => {
        this._modalOpened = false;
      });
    }
  }

  public async createModal(
    component: any,
    options: InfoModalInterface,
    backDrop: boolean = true,
    style: string = 'dynamic-height',
  ) {
    console.log(
      'ModalService createModal this._modalOpened',
      this._modalOpened,
    );
    if (this._modalOpened) {
      await this.closeModal();
    }
    const modal = await this.modalCtrl.create({
      component: component,
      backdropDismiss: backDrop,
      cssClass: style,
      componentProps: {
        options,
      },
    });
    await modal.present().then((_) => {
      this._modalOpened = true;
    });

    await modal.onDidDismiss().then((_) => {
      this._modalOpened = false;
    });
  }

  /**
   * @description Open loader
   * @param options
   */
  public async showLoader(options: any) {
    const loader = await this.loadingCtrl.create(options);
    loader.present().then();
  }

  /**
   * @description Close loader
   */
  public async hideLoader() {
    await this.loadingCtrl.dismiss().then();
  }

  // public async dismissModal(params?: any, role?: any) {
  //   await this.modalCtrl.dismiss(params, role);
  // }
}
