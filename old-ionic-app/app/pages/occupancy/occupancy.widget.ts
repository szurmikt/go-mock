import { AsyncPipe } from '@angular/common';
import { Component, inject, Input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IonImg, IonGrid, IonRow, IonCol } from '@ionic/angular/standalone';
import { TranslatePipe } from 'src/app/pipes/translate.pipe';
import { LanguageService } from 'src/app/services/languages/language.service';

@Component({
  selector: 'app-occupancy-widget',
  templateUrl: './occupancy.widget.html',
  styleUrl: './occupancy.widget.scss',
  standalone: true,
  imports: [IonCol, IonRow, IonGrid, IonImg, TranslatePipe, AsyncPipe],
})
export class OccupancyWidget implements OnInit {
  router: Router = inject(Router);
  languageService = inject(LanguageService);

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

  openPage() {
    this.router.navigate([this.url]).then();
  }
}
