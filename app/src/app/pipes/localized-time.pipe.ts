import { Pipe, PipeTransform } from '@angular/core';
import { formatPropertyInstant } from '../utils/date';

@Pipe({
  name: 'localizedTime',
  standalone: true,
})
export class LocalizedTimePipe implements PipeTransform {
  // `propertyTimeZone` is optional and unused by every current call site — see
  // `formatPropertyInstant`'s doc comment for why omitting it is not a
  // degraded case, and what wiring it up will require once the API supports it.
  transform(value: string | null | undefined, propertyTimeZone?: string | null): string {
    return formatPropertyInstant(value, propertyTimeZone);
  }
}
