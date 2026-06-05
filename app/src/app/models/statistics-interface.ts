export interface DocumentData {
  scan_type: string;
  document_type: string;
  date_of_issue: any;
  message: string;
  // false for address cards (lakcímkártya) — fill the address section only, never a
  // scanned ID record. undefined ⇒ treat as an identity document (passport/ID/licence).
  is_identity_document?: boolean;
}
