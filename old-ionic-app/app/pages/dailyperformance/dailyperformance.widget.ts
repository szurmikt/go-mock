import { Component, Input, OnInit } from '@angular/core';
import { IonGrid, IonRow, IonCol, IonImg } from '@ionic/angular/standalone';
import { TranslatePipe } from 'src/app/pipes/translate.pipe';

@Component({
  selector: 'app-dailyperformance-widget',
  templateUrl: './dailyperformance.widget.html',
  styleUrls: ['./dailyperformance.widget.scss'],
  standalone: true,
  imports: [IonImg, IonCol, IonRow, IonGrid, TranslatePipe],
})
export class DailyperformanceWidget implements OnInit {
  @Input()
  db_id!: string;

  @Input()
  widget_id!: string;

  @Input()
  data!: any;

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

  data_adr = 0;
  data_revpar = 0;

  days = [
    {
      day: 'yesterday',
      title: 'Yesterday',
      data: { reservations: 8, guests: 29, amount: 1302.15 },
    },
    {
      day: 'today',
      title: 'Today',
      data: { reservations: 5, guests: 12, amount: 722.57 },
    },
    {
      day: 'tomorrow',
      title: 'Tomorrow',
      data: { reservations: 6, guests: 8, amount: 650.33 },
    },
  ];

  activeDay = 'today';

  constructor() {}

  ngOnInit() {
    if (Object.hasOwn(this.data, 'adr')) {
      this.data_adr = this.data.adr;
    }
    if (Object.hasOwn(this.data, 'revpar')) {
      this.data_revpar = this.data.revpar;
    }
  }
}
