import { Pipe, PipeTransform } from '@angular/core';
import { DocType } from '../models/doc-type.interface';

@Pipe({
  name: 'docType',
})
export class DocTypePipe implements PipeTransform {
  transform(value: string, docTypes: DocType[]): string {
    return docTypes.find((e) => e.value == value)?.title ?? '';
  }
}
