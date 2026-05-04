import { Component, Input, OnInit } from '@angular/core';
import { FinanceInterface } from 'src/app/models/reservation.interface';

@Component({
  selector: 'app-finance-card',
  templateUrl: './finance-card.component.html',
  styleUrls: ['./finance-card.component.scss'],
  imports: [],
})
export class FinanceCardComponent implements OnInit {
  @Input()
  finance!: FinanceInterface;

  constructor() {}

  ngOnInit() {}
}
