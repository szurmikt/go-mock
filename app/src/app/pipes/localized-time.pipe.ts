import { Pipe, PipeTransform } from '@angular/core';
import { formatPropertyInstant } from '../utils/date';

@Pipe({
  name: 'localizedTime',
  standalone: true,
})
export class LocalizedTimePipe implements PipeTransform {
  // `propertyTimeZone` comes from PropertySettingsService via the selected property
  // (see reservation-detail.page.html) — see `formatPropertyInstant`'s doc comment
  // for the omitted-timeZone graceful-degradation case.
  transform(value: string | null | undefined, propertyTimeZone?: string | null): string {
    return formatPropertyInstant(value, propertyTimeZone);
  }
}
