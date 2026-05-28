import { Pipe, PipeTransform } from '@angular/core';

let formatter: Intl.DateTimeFormat | null = null;
function getFormatter(): Intl.DateTimeFormat {
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  return formatter;
}

@Pipe({
  name: 'localizedTime',
  standalone: true,
})
export class LocalizedTimePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (value == null || (typeof value === 'string' && value.trim() === '')) return '';
    // Normalize "YYYY-MM-DD HH:MM:SS" → ISO so WebKit parses it as local time.
    const d = new Date(value.replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) {
      const m = value.match(/(\d{1,2}:\d{2})/);
      return m ? m[1] : '';
    }
    return getFormatter().format(d);
  }
}
