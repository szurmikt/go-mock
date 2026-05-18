import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'dashIfEmpty',
  standalone: true,
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
    return value;
  }
}
