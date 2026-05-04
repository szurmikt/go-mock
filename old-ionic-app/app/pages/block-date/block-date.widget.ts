import { Component, inject, Input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IonImg, ModalController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { BlockDateModalComponent } from 'src/app/components/block-date-modal/block-date-modal.component';
import { TranslatePipe } from 'src/app/pipes/translate.pipe';

@Component({
  selector: 'app-block-date-widget',
  templateUrl: './block-date.widget.html',
  styleUrl: './block-date.widget.scss',
  standalone: true,
  imports: [IonImg, TranslatePipe],
})
export class BlockDateWidget implements OnInit {
  router: Router = inject(Router);
  modalCtrl = inject(ModalController);

  @Input()
  db_id!: string;

  @Input()
  widget_id!: string;

  @Input()
  data!: string;

  @Input()
  title!: string;

  @Input()
  url!: string;

  @Input()
  icon!: string;

  @Input()
  iconBg!: string;

  @Input()
  buttonBg!: string;

  constructor() {
    addIcons({
      left: 'assets/icon/icon-double-arrow-left-circled.svg',
      right: 'assets/icon/icon-double-arrow-right-circled.svg',
    });
  }

  ngOnInit() {}

  openModal() {
    this.modalCtrl
      .create({
        component: BlockDateModalComponent,
        cssClass: 'block-date-modal modal-small',
        componentProps: {},
        backdropDismiss: true,
      })
      .then((modal) => {
        // modal.onWillDismiss().then((data: any) => {
        //   this.loadData();
        // });
        modal.present();
      });
  }
}
