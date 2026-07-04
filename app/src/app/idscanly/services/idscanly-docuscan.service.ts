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

/** Whole years from an ISO birth date (YYYY-MM-DD) to today; null if unparseable. */
function computeAge(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const dob = new Date(iso);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age >= 0 && age < 150 ? String(age) : null;
}

@Injectable({ providedIn: 'root' })
export class IdscanlyDocuscanService {
  mapToScanResult(
    response: IdRecognitionResponse,
    documentType: DocumentTypeConfig,
  ): ScanResultInterface {
    const f: IdRecognitionFields = response.summary?.fields ?? {};

    // The live response splits the name as `givenNames`/`surname`; keep the
    // `firstName`/`lastName` variants as fallbacks in case the API changes.
    const firstName = (f.givenNames ?? f.firstName ?? '') as string;
    const lastName = (f.surname ?? f.lastName ?? '') as string;
    const fullName =
      (f.fullName as string | undefined) ??
      ([firstName, lastName].filter(Boolean).join(' ') || null);

    // No dedicated issue-date field; the live response surfaces it in visibleDates[0].
    const issueDate = f.dateOfIssue ?? f.visibleDates?.[0] ?? null;

    const scannedData: ScannedGuestDataInterface = {
      first_name: box(firstName || null),
      last_name: box(lastName || null),
      full_name: box(fullName || null),
      mother_name: box(f.motherMaidenName ?? f.motherName),
      maiden_name: box(null),
      birth_date: box(f.dateOfBirth),
      birth_place: box(f.placeOfBirth),
      gender: box(normGender(f.sex ?? f.gender)),
      citizenship: box(f.citizenship ?? f.nationality),
      age: box(computeAge(f.dateOfBirth)),
      // Document sub-fields
      document_type: box(f.documentType ?? documentType.label),
      document_number: box(f.documentNumber),
      date_of_issue_of_the_document: box(issueDate),
      // IDs set by Regula flow — IDScanly has no equivalent doc_reader_scanned_document_id
      doc_reader_scanned_document_id: box('idscanly'),
    };

    const documentData: DocumentData = {
      scan_type: 'idscanly',
      document_type: f.documentType ?? documentType.label,
      date_of_issue: issueDate,
      message: '',
      is_identity_document: documentType.id !== 'address-card',
    };

    return { documentData, scannedData };
  }
}
