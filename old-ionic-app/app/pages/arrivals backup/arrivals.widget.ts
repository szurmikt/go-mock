import {
  Component,
  inject,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
} from '@angular/core';
import {
  IonGrid,
  IonRow,
  IonCol,
  IonButton,
  IonSpinner,
} from '@ionic/angular/standalone';
import { NgClass, NgFor, NgIf } from '@angular/common';
import { WidgetsService } from 'src/app/services/widgets.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-arrivals-widget',
  templateUrl: './arrivals.widget.html',
  styleUrls: ['./arrivals.widget.scss'],
  standalone: true,
  imports: [
    IonSpinner,
    IonButton,
    IonCol,
    IonRow,
    IonGrid,
    IonButton,
    NgClass,
    NgFor,
    NgIf,
  ],
})
export class ArrivalsWidget implements OnInit, OnChanges, OnDestroy {
  widgetsService = inject(WidgetsService);

  @Input()
  db_id!: string;

  @Input()
  widget_id!: string;

  @Input()
  data!: {
    today: { amount: string; guests: string; reservations: string };
    tomorrow: { amount: string; guests: string; reservations: string };
    yesterday: { amount: string; guests: string; reservations: string };
  };

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

  data_reservations = 0;
  data_guests = 0;
  data_amount = 0;

  days = [
    {
      day: 'yesterday',
      title: 'Yesterday',
      data: {},
    },
    {
      day: 'today',
      title: 'Today',
      data: {},
    },
    {
      day: 'tomorrow',
      title: 'Tomorrow',
      data: {},
    },
  ];

  availableDays: any = [];

  activeDay = 'today';

  fetching: boolean = false;

  private dataSubscription!: Subscription;

  private intervalId: any;

  constructor() {
    console.log('ArrivalsWidget contructor data', this.data);
  }

  ngOnInit() {
    // console.log('ArrivalsWidget ngOnInit data', this.data);
    this.processData();
  }

  ngOnChanges() {
    console.log('ArrivalsWidget ngOnchanges data', this.data);
    this.processData();
    this.startFetchingData();
  }
  ionViewWillEnter() {
    console.log('ArrivalsWidget ionViewWillEnter data', this.data);
  }
  ionViewDidEnter() {
    console.log('ArrivalsWidget ionViewDidEnter data', this.data);
  }

  processData() {
    this.availableDays = [];
    if (Object.hasOwn(this.data, 'yesterday')) {
      let yesterday = this.days.find((day) => day.day == 'yesterday');
      yesterday!.data = this.data.yesterday;
      this.availableDays.push(yesterday);
    }
    if (Object.hasOwn(this.data, 'today')) {
      let today = this.days.find((day) => day.day == 'today');
      today!.data = this.data.today;
      this.availableDays.push(today);
    }
    if (Object.hasOwn(this.data, 'tomorrow')) {
      let tomorrow = this.days.find((day) => day.day == 'tomorrow');
      tomorrow!.data = this.data.tomorrow;
      this.availableDays.push(tomorrow);
    }
    switch (this.activeDay) {
      case 'yesterday':
        this.setData(this.days[0]);
        break;
      case 'today':
        this.setData(this.days[1]);
        break;
      case 'tomorrow':
        this.setData(this.days[2]);
        break;
    }
  }

  setData(day: any) {
    this.data_reservations = day.data.reservation;
    this.data_guests = day.data.guests;
    this.data_amount = day.data.amount;
  }

  changeDay(day: any) {
    this.activeDay = day.day;
    this.setData(day);
  }

  startFetchingData() {
    clearInterval(this.intervalId);
    this.intervalId = setInterval(() => {
      this.fetching = true;
      this.dataSubscription = this.widgetsService
        .fetchWidgetById(this.db_id, 5000)
        .subscribe((response) => {
          this.data = response.data;
          console.log('this.widgetsService.fetchWidgetById', response);
          this.fetching = false;
          this.processData();
          clearInterval(this.intervalId);
        });
    }, 5000);
  }

  ngOnDestroy() {
    if (this.dataSubscription) {
      this.dataSubscription.unsubscribe();
    }
    clearInterval(this.intervalId);
  }
}
