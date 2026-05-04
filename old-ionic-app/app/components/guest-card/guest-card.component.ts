import { Component, inject, Input, OnInit } from '@angular/core';
import { GuestInterface } from 'src/app/models/guest.interface';

import { DashIfEmptyPipe } from '../../pipes/dash-if-empty.pipe';
import { DefaultValuePipe } from '../../pipes/default-value.pipe';
import { OptionsService } from 'src/app/services/options.service';
import { TranslatePipe } from 'src/app/pipes/translate.pipe';

@Component({
  selector: 'app-guest-card',
  templateUrl: './guest-card.component.html',
  styleUrls: ['./guest-card.component.scss'],
  imports: [DashIfEmptyPipe, DefaultValuePipe, TranslatePipe],
})
export class GuestCardComponent implements OnInit {
  optionsService = inject(OptionsService);

  @Input()
  guest!: GuestInterface;

  options: { gender: any; document_type: any; country: any } | null = null;

  constructor() {}

  async ngOnInit() {
    this.options = await this.optionsService.get();
  }
}
