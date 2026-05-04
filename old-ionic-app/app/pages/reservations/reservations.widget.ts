import { Component, Input, OnInit } from '@angular/core';
import { WidgetButtonComponent } from 'src/app/components/widget-button/widget-button.component';
import { TranslatePipe } from 'src/app/pipes/translate.pipe';

@Component({
  selector: 'app-reservations-widget',
  template: `<widget-button
    [url]="url"
    [title]="title"
    [icon]="icon"
    [iconBg]="iconBg"
    [buttonBg]="buttonBg"
  ></widget-button>`,
  styleUrls: ['./reservations.page.scss'],
  standalone: true,
  imports: [WidgetButtonComponent, TranslatePipe],
})
export class ReservationsWidget implements OnInit {
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

  constructor() {}

  ngOnInit() {}
}
