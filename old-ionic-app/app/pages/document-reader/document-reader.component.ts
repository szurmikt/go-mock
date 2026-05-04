// document-reader.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { DocumentReaderService } from 'src/app/services/document-reader.service';

import {
  DocumentReader,
  DocReaderAction,
  FieldType,
  GraphicFieldType,
  InitConfig,
  RecognizeConfig,
  ResultType,
  RFIDConfig,
  ScannerConfig,
  Scenario,
  Results,
  DocReaderException,
  DocReaderScenario,
} from '@regulaforensics/document-reader';

@Component({
  selector: 'app-document-reader',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './document-reader.component.html',
})
export class DocumentReaderComponent implements OnInit {
  scenarios: DocReaderScenario[] = [];

  constructor(public reader: DocumentReaderService) {}

  ngOnInit() {
    console.log('DocumentReaderComponent ngOnInit');

    this.reader.init();
  }
}
