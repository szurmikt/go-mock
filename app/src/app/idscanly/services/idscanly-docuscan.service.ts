import { Injectable } from '@angular/core';
import {
  ScannedGuestDataInterface,
  ScanResultInterface,
} from '../../models/guest.interface';
import { DocumentData } from '../../models/statistics-interface';
import { DocumentTypeConfig } from '../models/document-type';
import { IdRecognitionFields, IdRecognitionResponse } from './idrecognition.service';

/**
 * Maps an IdRecognitionResponse → ScanResultInterface (the same type Regula produces),
 * so the existing guest-detail result sheet and processScanResult() work unchanged.
 *
 * Field names are best-effort and MUST be validated against a real live API response.
 * Update FIELD_MAP if the IDScanly endpoint returns different key names.
 */

function box(value: string | null | undefined): ScannedGuestDataInterface[string] {
  return { value: value ?? null, formatted_value: value ?? null, modified: false };
}

function normGender(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const u = raw.toUpperCase();
  if (u === 'M' || u === 'MALE') return 'Male';
  if (u === 'F' || u === 'FEMALE') return 'Female';
  return raw;
}

@Injectable({ providedIn: 'root' })
export class IdscanlyDocuscanService {
  mapToScanResult(
    response: IdRecognitionResponse,
    documentType: DocumentTypeConfig,
  ): ScanResultInterface {
    const f: IdRecognitionFields = response.summary?.fields ?? {};

    // Resolve first/last name — API may supply either split or combined in fullName.
    const firstName = f['firstName'] as string | undefined ?? '';
    const lastName = f['lastName'] as string | undefined ?? '';
    const fullName =
      (f['fullName'] as string | undefined) ??
      [firstName, lastName].filter(Boolean).join(' ') ??
      null;

    const scannedData: ScannedGuestDataInterface = {
      first_name: box(firstName || null),
      last_name: box(lastName || null),
      full_name: box(fullName || null),
      mother_name: box(f['motherName'] as string | undefined),
      maiden_name: box(null),
      birth_date: box(f['dateOfBirth'] as string | undefined),
      birth_place: box(f['placeOfBirth'] as string | undefined),
      gender: box(normGender(f['sex'] as string | undefined ?? f['gender'] as string | undefined)),
      citizenship: box(
        f['citizenship'] as string | undefined ??
        f['nationality'] as string | undefined,
      ),
      age: box(null),
      // Document sub-fields
      document_type: box(f['documentType'] as string | undefined ?? documentType.label),
      document_number: box(f['documentNumber'] as string | undefined),
      date_of_issue_of_the_document: box(f['dateOfIssue'] as string | undefined),
      // IDs set by Regula flow — IDScanly has no equivalent doc_reader_scanned_document_id
      doc_reader_scanned_document_id: box('idscanly'),
    };

    const documentData: DocumentData = {
      scan_type: 'idscanly',
      document_type: f['documentType'] as string | undefined ?? documentType.label,
      date_of_issue: f['dateOfIssue'] ?? null,
      message: '',
      is_identity_document: documentType.id !== 'address-card',
    };

    return { documentData, scannedData };
  }
}
