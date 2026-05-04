import { Component, inject, Input, OnInit } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { Router } from '@angular/router';
import { IonImg, IonGrid, IonCol, IonRow } from '@ionic/angular/standalone';
import { TranslatePipe } from 'src/app/pipes/translate.pipe';
import { LanguageService } from 'src/app/services/languages/language.service';

@Component({
  selector: 'app-guest-feedback-widget',
  templateUrl: './guest-feedback.widget.html',
  styleUrl: './guest-feedback.widget.scss',
  standalone: true,
  imports: [IonRow, IonCol, IonGrid, IonImg, TranslatePipe, AsyncPipe],
})
export class GuestFeedbackWidget implements OnInit {
  router: Router = inject(Router);
  languageService = inject(LanguageService);

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

  positive = 0;
  neutral = 0;
  negative = 0;
  all = 0;

  constructor() {}

  ngOnInit() {
    this.data = ['12', '3', '8'];
    console.log('GuestFeedbackWidget', this.data);
    this.calculateRates();
  }

  calculateRates() {
    this.positive = parseInt(this.data[0]);
    this.neutral = parseInt(this.data[1]);
    this.negative = parseInt(this.data[2]);
    this.all = this.positive + this.neutral + this.negative;
  }

  openPage() {
    this.router.navigate([this.url]).then();
  }
}
