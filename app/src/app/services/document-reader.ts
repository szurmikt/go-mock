import { Injectable, signal } from '@angular/core';

export enum ReaderStatus {
  INIT = 0,
  READY = 1,
  PROCESSING = 2,
  FINISHED = 3,
  TIMEOUT = 4,
  CANCELLED = 5,
  INTERRUPTED = 6,
  ERROR = 7,
}

@Injectable({ providedIn: 'root' })
export class DocumentReaderService {
  readonly status = signal<ReaderStatus>(ReaderStatus.ERROR).asReadonly();
  readonly scanResult = signal<null>(null).asReadonly();
  async init(): Promise<void> {}
  async scan(): Promise<boolean> { return false; }
}
