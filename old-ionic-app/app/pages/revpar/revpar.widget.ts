import { Component, inject, Input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IonImg } from '@ionic/angular/standalone';
import { TranslatePipe } from 'src/app/pipes/translate.pipe';

@Component({
  selector: 'app-revpar-widget',
  templateUrl: './revpar.widget.html',
  styleUrls: ['./revpar.widget.scss'],
  standalone: true,
  imports: [IonImg, TranslatePipe],
})
export class RevParWidget implements OnInit {
  router: Router = inject(Router);

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
