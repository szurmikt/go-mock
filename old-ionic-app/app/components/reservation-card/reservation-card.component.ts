import { NgClass } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { ReservationInterface } from 'src/app/models/reservation.interface';
import { TranslatePipe } from 'src/app/pipes/translate.pipe';

@Component({
  selector: 'app-reservation-card',
  templateUrl: './reservation-card.component.html',
  styleUrls: ['./reservation-card.component.scss'],
  imports: [NgClass, TranslatePipe],
})
export class ReservationCardComponent implements OnInit {
  @Input()
  reservation!: ReservationInterface;

  constructor() {}

  ngOnInit() {}
}
