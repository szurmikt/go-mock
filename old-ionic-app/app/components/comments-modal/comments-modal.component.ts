import { Component, inject, OnInit } from '@angular/core';
import { NavParams } from '@ionic/angular';
import {
  IonGrid,
  IonRow,
  IonCol,
  IonButton,
  ModalController,
} from '@ionic/angular/standalone';
import { UserService } from 'src/app/services/user.service';
import { Router } from '@angular/router';
import { ReservationInterface } from 'src/app/models/reservation.interface';

@Component({
  selector: 'app-comments-modal',
  templateUrl: './comments-modal.component.html',
  styleUrls: ['./comments-modal.component.scss'],
  imports: [IonRow, IonGrid, IonCol, IonButton],
})
export class CommentsModalComponent implements OnInit {
  navParams = inject(NavParams);
  modalCtrl: ModalController = inject(ModalController);
  userService: UserService = inject(UserService);
  router: Router = inject(Router);

  reservation: ReservationInterface | undefined;

  constructor() {
    this.reservation = this.navParams.get('reservation');
    console.log(
      'CommentsModalComponent const this.reservation',
      this.reservation
    );
  }

  ngOnInit() {}

  logout() {
    this.userService.logout().subscribe({
      next: (_) => {
        this.modalCtrl.dismiss();
        this.router.navigate(['login']).then();
      },
      error: (error) => {},
    });
  }

  close() {
    this.modalCtrl.dismiss();
  }
}
