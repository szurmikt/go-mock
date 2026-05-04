import { Component, inject, Input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IonImg } from '@ionic/angular/standalone';

@Component({
  selector: 'app-departures-widget',
  templateUrl: './departures.widget.html',
  styleUrls: ['./departures.widget.scss'],
  standalone: true,
  imports: [IonImg],
})
export class DeparturesWidget implements OnInit {
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
