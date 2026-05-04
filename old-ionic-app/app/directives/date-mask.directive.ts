import { Directive, HostListener } from '@angular/core';
import { NgControl } from '@angular/forms';

@Directive({
  selector: '[formControlName][dateMask]',
  standalone: true,
})
export class DateMaskDirective {
  constructor(public ngControl: NgControl) {}

  @HostListener('ngModelChange', ['$event'])
  onModelChange(event: any) {
    this.onInputChange(event, false);
  }

  @HostListener('keydown.backspace', ['$event'])
  keydownBackspace(event: any) {
    this.onInputChange(event.target.value, true);
  }

  onInputChange(event: any, backspace: any) {
    let newDate = '';

    let month: string = '';
    let day: string = '';
    let year: string = '';

    if (event) newDate = event.replaceAll('.', '').replaceAll(' ', '');
    console.log('backspace', backspace);
    console.log('newDate', newDate);

    if (backspace) {
      newDate = newDate.substring(0, newDate.length - 1);
    }
    if (newDate.length > 7) {
      if (newDate.match(/^[0-9]+$/) ? true : false)
        year = newDate.substring(0, 4);
      month = newDate.substring(4, 6);
      day = newDate.substring(6, 8);
      newDate = `${year}. ${month}. ${day}.`;

      this.ngControl?.valueAccessor?.writeValue(newDate);
    }
  }
}
