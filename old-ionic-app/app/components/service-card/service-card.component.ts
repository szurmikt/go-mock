import { Component, Input, OnInit } from '@angular/core';
import { ServiceInterface } from 'src/app/models/reservation.interface';

@Component({
  selector: 'app-service-card',
  templateUrl: './service-card.component.html',
  styleUrls: ['./service-card.component.scss'],
  imports: [],
})
export class ServiceCardComponent implements OnInit {
  @Input()
  service!: ServiceInterface;

  constructor() {}

  ngOnInit() {}
}
