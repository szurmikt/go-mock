import { Component, inject, Input, OnInit } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { Router } from '@angular/router';
import { IonImg } from '@ionic/angular/standalone';
import { ScanModalComponent } from 'src/app/components/scan-modal/scan-modal.component';
import { TranslatePipe } from 'src/app/pipes/translate.pipe';
import { LanguageService } from 'src/app/services/languages/language.service';

@Component({
  selector: 'app-idscan-widget',
  templateUrl: './idscan.widget.html',
  standalone: true,
  imports: [IonImg, TranslatePipe, AsyncPipe],
})
export class IdScanWidget implements OnInit {
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
