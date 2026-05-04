import { Component } from '@angular/core';
import { ModalService } from '../../services/modal.service';
import { InfoModalInterface } from '../../models/info-modal.interface';
import { NavParams } from '@ionic/angular';
import { IonImg, IonIcon, IonButton } from '@ionic/angular/standalone';

@Component({
  selector: 'info-modal',
  templateUrl: './info-modal.component.html',
  styleUrls: ['./info-modal.component.scss'],
  imports: [IonButton, IonIcon, IonImg],
})
export class InfoModalComponent {
  modalOptions: InfoModalInterface;

  constructor(
    private modalService: ModalService,
    private navParams: NavParams
  ) {
    this.modalOptions = this.navParams.get<InfoModalInterface>('options');
  }

  async close() {
    await this.modalService.closeModal();
  }

  btnClick(button: { handler: () => void }) {
    button.handler();
  }
}
