import {
  ChangeDetectorRef,
  Component,
  inject,
  Input,
  OnInit,
} from '@angular/core';
import { Router } from '@angular/router';
import { IonInput, IonIcon, IonButton } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { TranslatePipe } from 'src/app/pipes/translate.pipe';

@Component({
  selector: 'app-search',
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss'],
  imports: [IonButton, IonIcon, IonInput, TranslatePipe],
})
export class SearchComponent implements OnInit {
  router = inject(Router);
  cd = inject(ChangeDetectorRef);

  @Input()
  value: string | undefined;

  @Input() set updateSearchText(value: string) {
    // change detected here and you can do anything you want here
    console.log('SearchComponent updateSerchText value: ', value);

    this.searchText = value;
    this.cd.detectChanges();
  }

  @Input()
  onChangeCallback: Function | undefined;

  searchText: string = '';

  constructor() {
    addIcons({
      search: 'assets/icon/icon-search.svg',
      microphone: 'assets/icon/icon-microphone.svg',
    });
  }

  ngOnInit() {
    this.searchText = this.value ?? '';
  }

  onChange(event: any) {
    if (event) {
      let text = event.detail.value ?? '';
      console.log('changeSearchText called args', text);
      this.searchText = text;
      this.doSearch();
    }
  }

  doSearch() {
    if (this.searchText.length == 0 || this.searchText.length > 2) {
      if (this.onChangeCallback != undefined) {
        this.onChangeCallback(this.searchText);
      } else {
        this.router.navigate(['reservations'], {
          state: { searchText: this.searchText },
        });
      }
    }
  }

  startDictate() {}
}
