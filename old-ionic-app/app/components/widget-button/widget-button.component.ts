import { Component, Input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton, IonImg } from '@ionic/angular/standalone';

@Component({
  selector: 'widget-button',
  templateUrl: './widget-button.component.html',
  styleUrls: ['./widget-button.component.scss'],
  standalone: true,
  imports: [IonImg, IonButton],
})
export class WidgetButtonComponent implements OnInit {
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

  constructor(private router: Router) {}

  ngOnInit() {}

  Nav(url: string) {
    this.router.navigate([url]).then();
  }
}
