import {
  Component,
  inject,
  OnInit,
  ElementRef,
  ViewChild,
  ChangeDetectorRef,
  Input,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { IonSelectOption, IonSelect } from '@ionic/angular/standalone';
import { Language } from 'src/app/models/language.interface';
import { LanguageService } from 'src/app/services/languages/language.service';
import { FormGroup, FormControl, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-language-switcher',
  templateUrl: './language-switcher.component.html',
  styleUrls: ['./language-switcher.component.scss'],
  standalone: true,
  imports: [IonSelectOption, IonSelect, ReactiveFormsModule, NgClass],
})
export class LanguageSwitcherComponent implements OnInit {
  languageService = inject(LanguageService);
  cd = inject(ChangeDetectorRef);

  @Input()
  full: boolean | undefined;

  currentLanguage: string = 'En';
  currentLanguageFull: string = 'English';
  languages: Language[] = [];

  @ViewChild('languagesSelectRef', { read: ElementRef, static: true })
  languagesSelectRef!: ElementRef;

  form = new FormGroup({
    selectedLanguage: new FormControl(''),
  });

  constructor() {}

  ngOnInit() {
    console.log('LanguageSwitcherComponent ngOnInit full', this.full);

    this.form.get(['selectedLanguage'])!.setValue(this.currentLanguage);
    this.currentLanguage = this.languageService.currentLanguage;
    this.form.get(['selectedLanguage'])!.setValue(this.currentLanguage);
    console.log(
      'LanguageSwitcherComponent ngOnInit this.currentLanguage',
      this.currentLanguage,
    );
    this.languages = this.languageService.languages;
    console.log(
      'LanguageSwitcherComponent ngOnInit this.languages',
      this.languages,
    );
    if (this.languages && this.languages.length > 0) {
      let l: any = this.languages.filter((v) => v.code == this.currentLanguage);
      if (l) {
        this.currentLanguageFull = l.name;
      }
    }

    this.languageService.languagesBS.subscribe((languages) => {
      this.languages = languages;
      console.log(
        'LanguageSwitcherComponent languagesBS.subscribe this.languages',
        this.languages,
      );
      this.currentLanguage = this.languageService.currentLanguage;
      console.log(
        'LanguageSwitcherComponent languagesBS.subscribe this.currentLanguage',
        this.currentLanguage,
      );
      let l: any = this.languages.filter((v) => v.code == this.currentLanguage);
      if (l.length > 0) {
        this.currentLanguageFull = l[0].name;
        console.log(
          'LanguageSwitcherComponent languagesBS.subscribe this.currentLanguageFull',
          this.currentLanguageFull,
        );
      }
      this.form.get(['selectedLanguage'])!.setValue(this.currentLanguage);
      console.log(
        'this.form.value.selectedLanguage',
        this.form.value.selectedLanguage,
      );
    });

    // if (this.languages.length == 0) {
    //   this.languageService.languagesBS.subscribe((languages) => {
    //     this.languages = languages;
    //     console.log(
    //       'LanguageSwitcherComponent languagesBS.subscribe this.languages',
    //       this.languages,
    //     );
    //     this.currentLanguage = this.languageService.currentLanguage;
    //     console.log(
    //       'LanguageSwitcherComponent languagesBS.subscribe this.currentLanguage',
    //       this.currentLanguage,
    //     );
    //   });
    //   this.languageService.loadLanguageData().then((ret) => {
    //     // console.log('languageService.loadLanguageData ret', ret);
    //   });
    // }
  }

  open() {
    this.languagesSelectRef.nativeElement.click();
  }

  change(event: any) {
    this.currentLanguage = event.detail.value;
    this.languageService.currentLanguage = this.currentLanguage;
  }
}
