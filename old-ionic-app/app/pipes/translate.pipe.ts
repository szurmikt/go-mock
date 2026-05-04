import { inject, Pipe, PipeTransform } from '@angular/core';
import { LanguageService } from '../services/languages/language.service';

@Pipe({
  name: 'translateIT',
  standalone: true,
})
export class TranslatePipe implements PipeTransform {
  languageService = inject(LanguageService);
  private _translation: any = {};

  constructor() {}

  transform(text: any, tr?: any, value?: any, _lang?: string, date?: boolean) {
    // this._translation = tr;
    this._translation = this.languageService.translations;
    // ez tartalmazza a forditasokat

    // console.log('TranslatePipe tr', tr);
    // console.log('TranslatePipe this._translation', this._translation);

    if (this._translation) {
      const translationPath = text.split('.');
      let translation = '';
      if (date) {
        translationPath[0] = 'common';
        translationPath[1] = text;
      }

      if (
        this._translation.hasOwnProperty(translationPath[0]) &&
        this._translation[translationPath[0]].hasOwnProperty(translationPath[1])
      ) {
        translation = this._translation[translationPath[0]][translationPath[1]];
        if (value) {
          for (const index in value) {
            if (value.hasOwnProperty(index)) {
              translation = translation.replace(
                '{{' + index + '}}',
                value[index],
              ); // ha valtozo van a szovegben akkor azt lecsereljuk
            }
          }
        }
      }

      return translation;
    }
    return text;
  }
}
