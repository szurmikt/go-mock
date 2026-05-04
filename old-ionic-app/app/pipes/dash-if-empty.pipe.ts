import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'dashIfEmpty',
})
export class DashIfEmptyPipe implements PipeTransform {
  transform<T>(value: T | undefined | null): T | string {
    if (
      value === undefined ||
      value === null ||
      (typeof value === 'string' && value.trim() === '')
    ) {
      return 'N/A';
    }
    // if (typeof value === 'number' && isNaN(value)) {
    //   return '-';
    // }
    // if (typeof value === 'object' && Object.keys(value).length === 0) {
    //   return '-';
    // }
    return value;
  }
}
