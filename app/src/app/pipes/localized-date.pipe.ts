import { Pipe, PipeTransform } from '@angular/core';

let formatter: Intl.DateTimeFormat | null = null;
function getFormatter(): Intl.DateTimeFormat {
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  return formatter;
}

@Pipe({
  name: 'localizedDate',
  standalone: true,
})
export class LocalizedDatePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (value == null || (typeof value === 'string' && value.trim() === '')) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return getFormatter().format(d);
  }
}
