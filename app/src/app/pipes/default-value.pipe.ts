import { Pipe, PipeTransform } from '@angular/core';
import { openOutline } from 'ionicons/icons';

@Pipe({
  name: 'defaultValue',
  standalone: true,
})
export class DefaultValuePipe implements PipeTransform {
  constructor() {}

  transform(
    input: string,
    options: any,
    inputType: string,
    returnType: 'ID' | 'NAME' | 'OBJ' | '',
  ): any {
    // console.log('input', input);
    // console.log('options', options);
    // console.log('inputType', inputType);
    // console.log('returnType', returnType);

    if (
      input == null ||
      input == undefined ||
      input.length == 0 ||
      options == null ||
      options[inputType] == null
    ) {
      return input;
    }
    let opts = options[inputType];
    // console.log('opts', opts);
    // console.log('typeof opts', typeof opts);

    if (opts instanceof Array) {
      let match = opts.find((item: any) => {
        if (item.country_code == input) {
          return item;
        }
        return null;
      });
      if (match) {
        switch (returnType) {
          case 'ID':
            return match.id;
          case 'NAME':
            return match.name;
          case 'OBJ':
            return match;
          default:
            return match;
        }
      }
      return null;
    }
    for (const [key, value] of Object.entries(opts)) {
      if (key.toLocaleLowerCase() == input.toLocaleLowerCase()) {
        // console.log(`${key}: ${value}`);
        return (value as any).toString();
      }
    }
    return input + '*';
  }
}
