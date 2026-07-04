// document-reader.service.ts
import { Injectable, inject, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import * as Sentry from '@sentry/angular';
import {
  DocumentReader,
  DocReaderAction,
  InitConfig,
  ResultType,
  RFIDConfig,
  ScannerConfig,
  Scenario,
  Results,
  DocReaderException,
  DocReaderScenario,
} from '@regulaforensics/document-reader';

import { Config } from '../../config/config';

import {
  GuestPostInterface,
  ScannedDataInterface,
  ScannedGuestDataInterface,
  ScanResultInterface,
} from '../../models/guest.interface';
import { DocumentData } from '../../models/statistics-interface';

import { DocuscanService } from './docuscan.service';
import { MixpanelService } from '../../services/mixpanel';

import { DefaultValuePipe } from '../../pipes/default-value.pipe';
import { parseHungarianAddress } from '../../utils/hungarian-address';

@Injectable({ providedIn: 'root' })
export class DocumentReaderService {
  reader = DocumentReader.instance;
  docuscanService = inject(DocuscanService);
  private mixpanel = inject(MixpanelService);

  /** Counts user-initiated scan launches since the last successful scan, so
   *  scan_succeeded can report how many attempts a scan took. */
  private _scanAttempts = 0;

  private _readerStatus = signal<ReaderStatus>(ReaderStatus.INIT);
  readonly readerStatus = this._readerStatus.asReadonly();

  private _scanResult = signal<ScanResultInterface>({
    documentData: null,
    scannedData: null,
  });
  readonly scanResult = this._scanResult.asReadonly();

  private _scenarios = signal<DocReaderScenario[]>([]);
  readonly scenarios = this._scenarios.asReadonly();

  selectedScenario: Scenario = Scenario.FULL_PROCESS;

  private _canRfid = signal<boolean>(false);
  readonly canRfid = this._canRfid.asReadonly();

  doRfid = false;
  isReadingRfid = false;

  fieldsToScan: any;
  options: any;

  private documentData: DocumentData = {
    document_type: '',
    scan_type: '',
    date_of_issue: '',
    message: '',
  };

  guestPostData: GuestPostInterface = {
    // address: {},
    guest: {},
    reservation_code: '',
  };

  scannedData: ScannedDataInterface = {
    doc_reader_scanned_document_id: '',
    first_name: '',
    last_name: '',
    full_name: '',
    mother_name: '',
    maiden_name: '',
    birth_date: '',
    birth_place: '',
    gender: '',
    citizenship: '',
    age: 0,
    document: {
      document_type: '',
      document_number: '',
      date_of_issue_of_the_document: '',
    },
  };

  scannedGuestData: ScannedGuestDataInterface = {};

  /** Pages captured in the current scan session; reset by resetScanSession(). */
  private pagesScanned = 0;
  /** Safety cap on multipage advance, so a misreported morePagesAvailable can't loop. */
  private static readonly MAX_PAGES = 3;

  constructor() {
    // The Regula plugin reaches through to the native (cordova) bridge as soon as
    // these params are set. On web/Electron `cordova` is undefined, so touching them
    // here throws `ReferenceError: cordova is not defined` during Angular DI — which
    // aborts construction of any page that injects this service (e.g. GuestDetailPage,
    // so the Guest Card never opens). Scanning is native-only anyway, so guard it.
    if (Capacitor.isNativePlatform()) {
      // Manual multipage per Regula's documented flow: multipageProcessing = false +
      // manualMultipageMode = true, then drive paging via results.morePagesAvailable in
      // handleCompletion(). This is what Regula's own DocReader app does — single-page
      // docs (passport, address card) close after one page with NO "provide next page"
      // Skip prompt, while a 2-sided ID card reports morePagesAvailable > 0 and we advance
      // to the back. The cross-scan stale-data leak is fixed by reader.startNewSession()
      // in scan() (resets the accumulated package).
      this.reader.processParams.multipageProcessing = false;
      this.reader.functionality.manualMultipageMode = true;
      // 'MM' = month; lowercase 'mm' is MINUTES, which yields an invalid date like
      // 1985-00-22 that <input type="date"> and `new Date(...)` both silently reject.
      this.reader.processParams.dateFormat = 'yyyy-MM-dd';
      this.reader.functionality.showTorchButton = true;
    }
  }

  async init() {
    // Document scanning requires the native Regula plugin; no-op on web/Electron.
    if (!Capacitor.isNativePlatform()) return;
    if (this._readerStatus() === ReaderStatus.READY) return;

    const ok = await this.initialize();
    if (!ok) return;

    this.configureRfidDataGroups();

    this._canRfid.set(await this.reader.isRFIDAvailableForUse());
    // Read the document chip (NFC) when the device supports it — matches Regula's flow
    // (optical front → chip), so 2-sided ID cards don't need an optical back-flip. On
    // devices without NFC this stays false and we fall back to the optical multipage path.
    this.doRfid = this._canRfid();
    this.logRfidAvailability();
    this._readerStatus.set(ReaderStatus.READY);
  }

  /**
   * Diagnostic: why is RFID (NFC chip read) available or not? `isRFIDAvailableForUse()`
   * depends on the LICENSE (`license.isRfidAvailable`) AND the Core framework/device
   * capabilities — NOT the iOS NFC entitlement. Logging the bundled license's RFID flag
   * tells us whether the deployed regula.license actually carries the RFID feature, vs a
   * framework/device gap. Surfaced to Sentry (Logs + a findable Issue) + console.
   */
  /**
   * Limit RFID chip reading to the data groups we actually use, and skip the heavy
   * biometric/image groups. DG2 (facial image) is large and slow over NFC and we never
   * display it; DG3/DG4 (fingerprints/iris) are EAC-protected anyway; DG5/DG7 are the
   * portrait/signature images. We keep DG1 (MRZ), DG11 (additional personal details —
   * place of birth, etc.) and DG12 (doc details — date of issue), and leave DG14/DG15
   * (chip/active authentication) at their native defaults so authentication is unaffected.
   *
   * Only the ePassport (eMRTD) application is configured — HU passports and ID cards read
   * via it (that's where the slow DG2 photo lives). Each setter pushes a merged partial
   * update to native, so untouched groups (DG1, DG8–DG16) keep their defaults.
   * Must run after initialize() — that's when reader.rfidScenario is populated from native.
   */
  private configureRfidDataGroups(): void {
    const ep = this.reader.rfidScenario?.ePassportDataGroups;
    if (!ep) {
      console.warn('[regula] ePassportDataGroups not available; cannot limit RFID groups');
      return;
    }
    ep.dg2 = false; // facial image — the large/slow one
    ep.dg3 = false; // fingerprints (EAC-protected)
    ep.dg4 = false; // iris (EAC-protected)
    ep.dg5 = false; // displayed portrait image
    ep.dg6 = false; // reserved
    ep.dg7 = false; // displayed signature image

    if (Config.SCAN_DEBUG_LOGGING) {
      const flags = {
        dg1: ep.dg1, dg2: ep.dg2, dg5: ep.dg5, dg7: ep.dg7,
        dg11: ep.dg11, dg12: ep.dg12, dg14: ep.dg14, dg15: ep.dg15,
      };
      console.log('[regula] RFID data groups limited', flags);
      Sentry.logger.info('Regula RFID data groups limited', flags);
    }
  }

  private logRfidAvailability(): void {
    const license = this.reader.license;
    const payload = {
      rfid_available_for_use: this.doRfid,
      license_is_rfid_available: license?.isRfidAvailable ?? null,
      license_expiry: license?.expiryDate ?? null,
      available_scenarios: (this.scenarios() ?? []).map((s: any) => String(s?.name ?? s)).join(','),
      platform: Capacitor.getPlatform(),
    };
    console.log('[regula] RFID availability', payload, 'license', license);
    if (Config.SCAN_DEBUG_LOGGING) {
      Sentry.logger.info('Regula RFID availability', payload);
      Sentry.captureMessage(
        `Regula RFID availability: forUse=${payload.rfid_available_for_use} licenseRfid=${payload.license_is_rfid_available}`,
        {
          level: 'info',
          tags: {
            context: 'rfid_availability',
            regula_rfid_for_use: String(payload.rfid_available_for_use),
            regula_license_rfid: String(payload.license_is_rfid_available),
          },
        },
      );
    }
  }

  async scan() {
    if (!(await this.reader.isReady())) return;

    this._scanAttempts++;
    this.clearResults();
    this.resetScanSession();
    // Regula: resets the accumulated multipage package so this scan starts as an
    // entirely new document. Without it, manual multipage re-delivers the previous
    // scan's results on the next startScanner.
    this.reader.startNewSession();

    Sentry.addBreadcrumb({
      category: 'regula',
      level: 'info',
      message: 'scan started',
      data: {
        scenario: String(this.selectedScenario),
        multipageProcessing: this.reader.processParams.multipageProcessing,
        doRfid: this.doRfid,
      },
    });

    this.launchScanner();
  }

  /** Opens the Regula scanner UI. Reused to re-open it for the next page in manual
   *  multipage mode (after startNewPage()). */
  private launchScanner() {
    this.reader.startScanner(
      ScannerConfig.withScenario(this.selectedScenario),
      this.handleCompletion.bind(this),
    );
  }

  private handleCompletion(
    action: DocReaderAction,
    results: Results | null,
    error: DocReaderException | null,
  ) {
    this.handleException(error);

    console.log(
      'handleCompletion action',
      action,
      'key',
      this.getReaderActionKey(action),
    );
    // console.log('handleCompletion results', results);
    // console.log('handleCompletion error', error);

    // console.log('handleCompletion this.doRfid', this.doRfid);
    // console.log('handleCompletion this.isReadingRfid', this.isReadingRfid);
    // console.log('handleCompletion results != null', results != null);
    // console.log('handleCompletion results.chipPage', results?.chipPage);

    let shoudlRfid = this.shouldRfid(results);
    // console.log('handleCompletion shouldRfid', shoudlRfid);

    const isFailureAction =
      action === DocReaderAction.TIMEOUT ||
      action === DocReaderAction.CANCEL ||
      DocReaderAction.interrupted(action);

    if (this.isReadingRfid && isFailureAction) {
      // The optical scan already succeeded; only the chip (NFC) read failed or was
      // cancelled. Don't throw away the optical data — finalize with what we have so the
      // result sheet still shows the document. (NFC fallback to optical.)
      this.isReadingRfid = false;
      this.logScanOutcome(action, results, error);
      console.log('handleCompletion RFID failed → finalize optical', results);
      this.processResults(results).then(() =>
        this.logScanOutcome(action, results, error, this._scanResult()),
      );
    } else if (action === DocReaderAction.TIMEOUT) {
      this.logScanOutcome(action, results, error);
      this._readerStatus.set(ReaderStatus.TIMEOUT);
    } else if (action === DocReaderAction.CANCEL) {
      this.logScanOutcome(action, results, error);
      this._readerStatus.set(ReaderStatus.CANCELLED);
    } else if (DocReaderAction.interrupted(action)) {
      this.logScanOutcome(action, results, error);
      this._readerStatus.set(ReaderStatus.INTERRUPTED);
    } else if (DocReaderAction.stopped(action) && !this.shouldRfid(results)) {
      // Manual multipage: advance to a second page ONLY for a 2-sided ID card (its back
      // carries MRZ / mother's name / place of birth). We CANNOT use morePagesAvailable
      // as the gate — Regula reports the document's physical page count, which is also
      // non-zero for a passport booklet and the address card's back, so single-page docs
      // would wrongly prompt for a 2nd page. Gate on document type instead; morePages is
      // still required so we stop once the ID card's back is in (front: !=0 → advance;
      // back: ==0 → finalize). MAX_PAGES is a final runaway guard.
      const morePages = results?.morePagesAvailable ?? 0;
      const docType = results?.documentType?.[0]?.type;
      const isIdCard = docType != null && Config.ID_CARDS.includes(docType);
      // Only advance on the pure-optical path. When we're reading the chip (NFC device +
      // doc with a chip), the back side isn't needed and the post-RFID completion must
      // finalize, not advance — so require no-NFC OR no chip on this document.
      const opticalOnly = !this.doRfid || (results?.chipPage ?? 0) === 0;
      const shouldAdvance =
        isIdCard &&
        opticalOnly &&
        morePages !== 0 &&
        this.pagesScanned < DocumentReaderService.MAX_PAGES;

      this.logPageDecision(results, {
        isIdCard,
        morePages,
        pagesScanned: this.pagesScanned,
        decision: shouldAdvance ? 'advance' : 'finalize',
      });

      if (shouldAdvance) {
        this.pagesScanned++;
        this.reader.startNewPage();
        this.launchScanner();
      } else {
        console.log('handleCompletion processResults', results);
        this.processResults(results).then(() =>
          this.logScanOutcome(action, results, error, this._scanResult()),
        );
      }
    } else if (DocReaderAction.finished(action) && this.shouldRfid(results)) {
      this.isReadingRfid = true;
      this.readRfid();
    }

    // if (DocReaderAction.stopped(action) && !this.shouldRfid(results)) {
    //   console.log('handleCompletion processResults', results);
    //   this.processResults(results);
    // } else if (DocReaderAction.finished(action) && this.shouldRfid(results)) {
    //   this.isReadingRfid = true;
    //   this.readRfid();
    // } else if (action === DocReaderAction.TIMEOUT) {
    //   this._readerStatus.set('Scan timeout');
    // } else if (action === DocReaderAction.CANCEL) {
    //   this._readerStatus.set('Scan cancelled');
    // } else if (DocReaderAction.interrupted(action)) {
    //   this._readerStatus.set('Scan Interrupted');
    // }
  }

  /**
   * Detailed per-page multipage decision log → Sentry (Logs + a visible Issue) + console.
   * Captures what Regula detected (document type/id/format, pages remaining, chip page)
   * and how our code treated it (classified as ID card? advance or finalize? which page).
   * This is the data we use to verify/triage the single-page-vs-2-sided behavior on device.
   */
  private logPageDecision(
    results: Results | null,
    info: {
      isIdCard: boolean;
      morePages: number;
      pagesScanned: number;
      decision: 'advance' | 'finalize';
    },
  ): void {
    const diagnostics = this.buildScanDiagnostics(DocReaderAction.COMPLETE, results, null);
    const docType = diagnostics['documentType']?.[0];
    const payload = {
      decision: info.decision,
      is_id_card: info.isIdCard,
      more_pages: Number(diagnostics['morePagesAvailable'] ?? -1),
      page_just_completed: info.pagesScanned + 1,
      pages_scanned_before: info.pagesScanned,
      doc_type: String(docType?.name ?? 'unknown'),
      doc_type_id: Number(docType?.type ?? -1),
      doc_format: docType?.format ?? null,
      country: docType?.countryName ?? null,
      chip_page: Number(diagnostics['chipPage'] ?? -1),
      processing_status: diagnostics['processingFinishedStatus'] ?? null,
      diagnostics_json: JSON.stringify(diagnostics),
    };

    console.log('[regula] page decision', payload);

    if (Config.SCAN_DEBUG_LOGGING) {
      Sentry.addBreadcrumb({
        category: 'regula',
        level: 'info',
        message: `page decision: ${info.decision}`,
        data: payload,
      });
      Sentry.logger.info('Regula page decision', payload);
      // Also raise a (low-noise, info-level) Issue so it's easy to find while testing.
      Sentry.captureMessage(
        `Regula page decision: ${info.decision} — ${payload.doc_type} (id ${payload.doc_type_id}, morePages ${payload.more_pages})`,
        {
          level: 'info',
          tags: {
            context: 'scan_page_decision',
            regula_decision: info.decision,
            regula_doc_type: payload.doc_type,
            regula_doc_type_id: String(payload.doc_type_id),
            regula_is_id_card: String(info.isIdCard),
            regula_more_pages: String(payload.more_pages),
          },
        },
      );
    }
  }

  private buildScanDiagnostics(
    action: DocReaderAction,
    results: Results | null,
    error: DocReaderException | null,
  ): Record<string, any> {
    const safe = <T>(fn: () => T): T | null => {
      try {
        const v = fn();
        return v === undefined ? null : v;
      } catch {
        return null;
      }
    };
    const r = results as any;
    return {
      actionKey: this.getReaderActionKey(action),
      readerStatus: this.getReaderStatusKey(this._readerStatus()),
      scenario: String(this.selectedScenario),
      multipageProcessing: safe(() => this.reader.processParams.multipageProcessing),
      doRfid: this.doRfid,
      isReadingRfid: this.isReadingRfid,
      documentType: safe(() =>
        results?.documentType?.map((d: any) => ({
          name: d?.name ?? null,
          type: d?.type ?? null,
          format: d?.format ?? null,
          documentName: d?.documentName ?? null,
          countryName: d?.countryName ?? null,
        })),
      ),
      processingFinishedStatus: safe(() => r?.processingFinishedStatus),
      overallStatus: safe(() => r?.status),
      morePagesAvailable: safe(() => r?.morePagesAvailable),
      chipPage: safe(() => r?.chipPage),
      elapsedTime: safe(() => r?.elapsedTime),
      imageQuality: safe(() => r?.imageQuality),
      errorMessage: safe(() => (error as any)?.message ?? (error as any)?.what ?? null),
    };
  }

  private logScanOutcome(
    action: DocReaderAction,
    results: Results | null,
    error: DocReaderException | null,
    mapped: ScanResultInterface | null = null,
  ): void {
    // Classify the outcome. CANCEL is checked before interrupted() because the
    // Regula SDK's interrupted() also returns true for CANCEL — a user backing
    // out is not a failure and must not raise an Issue.
    let level: 'info' | 'warning' | 'error' = 'info';
    let outcome = 'finished';
    let isFailure = false;
    if (action === DocReaderAction.TIMEOUT) {
      level = 'warning';
      outcome = 'timed out';
      isFailure = true;
    } else if (action === DocReaderAction.CANCEL) {
      outcome = 'cancelled';
    } else if (DocReaderAction.interrupted(action)) {
      level = 'warning';
      outcome = 'interrupted';
      isFailure = true;
    } else if (error) {
      level = 'error';
      outcome = 'error';
      isFailure = true;
    }

    const diagnostics = this.buildScanDiagnostics(action, results, error);
    const rawResult = (() => {
      try {
        return results?.rawResult ?? null;
      } catch {
        return null;
      }
    })();
    const title = `Regula scan ${outcome}`;

    // Full payload to the device console (Xcode / Console.app) during testing.
    const consolePayload = { diagnostics, mapped, rawResult };
    if (level === 'error') {
      console.error(`[regula] ${title}`, consolePayload);
    } else if (level === 'warning') {
      console.warn(`[regula] ${title}`, consolePayload);
    } else {
      console.log(`[regula] ${title}`, consolePayload);
    }

    if (Config.SCAN_DEBUG_LOGGING) {
      const cappedRaw =
        rawResult && rawResult.length > 16000
          ? `${rawResult.slice(0, 16000)}…[truncated ${rawResult.length} chars]`
          : (rawResult ?? '');
      const docType = diagnostics['documentType']?.[0];
      const attributes = {
        outcome,
        action: String(diagnostics['actionKey']),
        reader_status: String(diagnostics['readerStatus']),
        scenario: String(diagnostics['scenario']),
        multipage: !!diagnostics['multipageProcessing'],
        do_rfid: !!diagnostics['doRfid'],
        more_pages: Number(diagnostics['morePagesAvailable'] ?? -1),
        chip_page: Number(diagnostics['chipPage'] ?? -1),
        elapsed_time: Number(diagnostics['elapsedTime'] ?? -1),
        doc_type: String(docType?.name ?? 'unknown'),
        doc_type_id: Number(docType?.type ?? -1),
        diagnostics_json: JSON.stringify(diagnostics),
        mapped_displayed: mapped ? JSON.stringify(mapped) : '',
        raw_result: cappedRaw,
      };
      if (level === 'warning') {
        Sentry.logger.warn(title, attributes);
      } else if (level === 'error') {
        Sentry.logger.error(title, attributes);
      } else {
        Sentry.logger.info(title, attributes);
      }
    }

    // Failures also surface as Issues for visibility / alerting.
    if (isFailure) {
      const docType = diagnostics['documentType']?.[0];
      Sentry.withScope((scope) => {
        scope.setLevel(level);
        scope.setTag('regula.action', String(diagnostics['actionKey']));
        scope.setTag('regula.doc_type', String(docType?.name ?? 'unknown'));
        scope.setTag('regula.more_pages', String(diagnostics['morePagesAvailable']));
        scope.setTag('regula.multipage', String(diagnostics['multipageProcessing']));
        scope.setContext('regula_scan', diagnostics);
        if (error) {
          Sentry.captureException(error);
        } else {
          Sentry.captureMessage(title, level);
        }
      });
    }

    // Product analytics (Mixpanel): one event per terminal scan outcome.
    // scan_type is derived from doRfid (the chip-read path was attempted) — an
    // approximation, since isReadingRfid is already reset by processResults on
    // the success call. Categorical document type only — never guest PII.
    const mpDocType = diagnostics['documentType']?.[0];
    const scanType: 'optical' | 'rfid' = diagnostics['doRfid'] ? 'rfid' : 'optical';
    if (outcome === 'finished') {
      this.mixpanel.trackScanSucceeded({
        attempts: this._scanAttempts,
        document_type: String(mpDocType?.name ?? 'unknown'),
        document_type_id: Number(mpDocType?.type ?? -1),
        scan_type: scanType,
      });
      this._scanAttempts = 0;
    } else if (mapped == null) {
      // timed out / cancelled / interrupted / error (no result extracted).
      // The RFID-fallback path that yields optical results carries mapped != null
      // and is intentionally not counted as a failure here.
      const reasonMap: Record<string, 'timed_out' | 'cancelled' | 'interrupted' | 'error'> = {
        'timed out': 'timed_out',
        cancelled: 'cancelled',
        interrupted: 'interrupted',
        error: 'error',
      };
      const reason = reasonMap[outcome];
      if (reason) {
        this.mixpanel.trackScanFailed({
          reason,
          attempt_number: this._scanAttempts,
          scan_type: scanType,
        });
      }
    }
  }

  private async processResults(results: Results | null) {
    this._readerStatus.set(ReaderStatus.PROCESSING);
    this.isReadingRfid = false;
    this.clearResults();

    if (!results) return;

    console.log('processResults results', results);

    let issuingAuthority = await results.textFieldValueByType(1);

    this.documentData.document_type = results.documentType![0].name ?? '';
    this.documentData.date_of_issue = await results.textFieldValueByType(4);
    this.documentData.message = '';
    this.documentData.scan_type =
      results.chipPage != 0 && this.doRfid ? 'rfid' : 'ocr';

    for (const field of this.fieldsToScan) {
      let fieldValue = null;
      if (
        field.regula_id === 0 &&
        results.documentType &&
        results.documentType.length > 0
      ) {
        console.log(results.documentType[0].type);

        if (
          Config.DRIVING_LICENCES.includes(results.documentType[0].type ?? 0)
        ) {
          fieldValue = 'driving_license';
        } else if (
          Config.PASSPORTS.includes(results.documentType[0].type ?? 0)
        ) {
          fieldValue = 'passport';
        } else if (
          Config.ID_CARDS.includes(results.documentType[0].type ?? 0)
        ) {
          fieldValue = 'id';
        }
      } else {
        if (results.chipPage != 0 && this.doRfid) {
          // this.stopRfid().then();
          let valueByLcIDSource = await results.textFieldValueByTypeLcidSource(
            field.regula_id,
            field.lc_id,
            ResultType.RFID_TEXT_DATA,
          );
          if (valueByLcIDSource == '' || valueByLcIDSource == null) {
            valueByLcIDSource = await results.textFieldValueByType(
              field.regula_id,
            );
            // MaidenName
            if (
              field.regula_id === 126 &&
              (valueByLcIDSource == '' || valueByLcIDSource == null)
            ) {
              valueByLcIDSource = await results.textFieldValueByTypeLcidSource(
                432,
                field.lc_id,
                ResultType.RFID_TEXT_DATA,
              );
              if (valueByLcIDSource == '' && valueByLcIDSource == null) {
                valueByLcIDSource = await results.textFieldValueByType(432);
              }
            }
          }
          fieldValue = valueByLcIDSource;
        } else {
          // this.stopScan().then();
          let valueByLcID = await results.textFieldValueByTypeLcid(
            field.regula_id,
            field.lc_id,
          );
          if (valueByLcID == '' || valueByLcID == null) {
            valueByLcID = await results.textFieldValueByType(field.regula_id);
            // MaidenName
            if (
              field.regula_id === 126 &&
              (valueByLcID == '' || valueByLcID == null)
            ) {
              valueByLcID = await results.textFieldValueByTypeLcid(
                432,
                field.lc_id,
              );
              if (valueByLcID == '' && valueByLcID == null) {
                valueByLcID = await results.textFieldValueByType(432);
              }
            }
          }
          fieldValue = valueByLcID;
        }

        if (fieldValue == '') {
          fieldValue = null;
        }

        if (field.name == 'document_number') {
          fieldValue = this.alterDocNumber(fieldValue);
        }

        if (
          issuingAuthority != 'TUR' &&
          issuingAuthority != 'KKT' &&
          field.name == 'turkish_republic_identity_number'
        ) {
          fieldValue = null;
        }

        if (field.lc_id !== 0) {
          // Remove \n, ^ characters from string, make uppercase the first letter of non-unicode string
          if (fieldValue != null) {
            fieldValue =
              fieldValue.indexOf('^') > 0
                ? fieldValue.replace('^', '')
                : fieldValue;
            fieldValue =
              fieldValue.indexOf('>>') > 0
                ? fieldValue.replace('>>', ' ')
                : fieldValue;
            fieldValue =
              fieldValue.indexOf('<<') > 0
                ? fieldValue.replace('<<', ' ')
                : fieldValue;
            fieldValue =
              fieldValue.indexOf('>') > 0
                ? fieldValue.replace('>', ' ')
                : fieldValue;
            fieldValue =
              fieldValue.indexOf('<') > 0
                ? fieldValue.replace('<', ' ')
                : fieldValue;
            fieldValue =
              fieldValue.indexOf('\n') > 0
                ? fieldValue.replace('\n', '')
                : fieldValue;
            fieldValue =
              fieldValue.indexOf(',') > 0
                ? fieldValue.replace(',', ', ')
                : fieldValue;
            fieldValue = fieldValue
              .toLowerCase()
              .replace(/(^\w|\s\w|\(\w)/g, (m: any) => m.toUpperCase());
            fieldValue =
              fieldValue.charAt(0).toUpperCase() + fieldValue.slice(1);
          }
        }
      }

      // Gender manipulation
      if (field.regula_id === 12) {
        fieldValue =
          fieldValue === 'M' ? 'Male' : fieldValue === 'F' ? 'Female' : null;
      }
      this.scannedGuestData[field.name] = {
        value: fieldValue,
        formatted_value: fieldValue,
        modified: false,
        error: false,
      };
    }

    const docTypeId = results.documentType?.[0]?.type ?? -1;
    const isAddressCard = Config.ADDRESS_CARDS.includes(docTypeId);
    this.documentData.is_identity_document = !isAddressCard;

    if (isAddressCard) {
      // Address card (lakcímkártya): capture ONLY the residence address and drop any
      // name/identity/document fields the OCR returned, so it neither prefills identity
      // fields nor becomes a scanned ID record. (Skipping fixNameFields also avoids its
      // hard read of scannedGuestData['first_name'].value.)
      await this.captureAddressFields(results, issuingAuthority);
      this.stripToAddressFields();
    } else {
      this.alterPersonalData();

      this.fixNameFields();

      this.fixCountryAndCitizenshipFields();

      await this.captureAddressFields(results, issuingAuthority);
    }

    // this.docuscanService.lastGuestPostData = this.guestPostData;
    // console.log(
    //   'this.docuscanService.lastGuestPostData',
    //   this.docuscanService.lastGuestPostData,
    // );

    // this.docuscanService.lastDocumentData = this.documentData;
    // console.log(
    //   'this.docuscanService.lastDocumentData',
    //   this.docuscanService.lastDocumentData,
    // );

    console.log('processResults this.guestPostData', this.guestPostData);
    console.log('processResults this.scannedGuestData', this.scannedGuestData);
    console.log('processResults this.documentData', this.documentData);

    this._readerStatus.set(ReaderStatus.FINISHED);
    this._scanResult.set({
      documentData: this.documentData,
      scannedData: this.scannedGuestData,
    });
  }

  private fixCountryAndCitizenshipFields() {
    if (
      this.scannedGuestData.hasOwnProperty('citizenship') &&
      this.scannedGuestData.hasOwnProperty('country_code')
    ) {
      console.log('has citizenship && country_code');

      if (
        this.scannedGuestData['country_code'] != null &&
        this.scannedGuestData['country_code']['formatted_value'] != null
      ) {
        console.log('has country_code && country_code formatted');
        let defaultPipe = new DefaultValuePipe();
        this.scannedGuestData['citizenship']['formatted_value'] =
          defaultPipe.transform(
            this.scannedGuestData['country_code'][
              'formatted_value'
            ].toLocaleUpperCase(),
            this.options,
            'country',
            'ID',
          );
      } else {
        if (
          this.scannedGuestData['citizenship'] != null &&
          this.scannedGuestData['country_code']['formatted_value'] != null &&
          this.scannedGuestData['citizenship']['formatted_value'].length == 3
        ) {
          let defaultPipe = new DefaultValuePipe();
          this.scannedGuestData['citizenship']['formatted_value'] =
            defaultPipe.transform(
              this.scannedGuestData['citizenship'][
                'formatted_value'
              ].toLocaleUpperCase(),
              this.options,

              'country',
              'ID',
            );
        } else {
          this.scannedGuestData['citizenship']['formatted_value'] = null;
        }
      }
      this.scannedGuestData['citizenship']['value'] =
        this.scannedGuestData['country_code']['value'];
    } else {
      console.log('NOT has citizenship && country_code');
    }
  }

  /**
   * Captures the guest residence address from an address card (lakcímkártya).
   * Regula returns the whole address as a single PLACE_OF_REGISTRATION (69)
   * string (fallback ADDRESS (17)); we parse it into ZIP / city / street and
   * derive the country from the issuing-state code. These are emitted under
   * dedicated `address_*` keys (not `country_code`, which the citizenship logic
   * owns) so docuscan can nest them into the guest `address` object. Identity
   * documents (passport/ID) return neither field, so this is inert for them.
   */
  private async captureAddressFields(
    results: Results,
    issuingStateCode: string | null,
  ) {
    const raw =
      (await results.textFieldValueByType(69)) ||
      (await results.textFieldValueByType(17));
    if (!raw) return;

    const parsed = parseHungarianAddress(raw);
    const set = (key: string, value: string | null) => {
      this.scannedGuestData[key] = {
        value,
        formatted_value: value,
        modified: false,
        error: false,
      };
    };

    set('address_country_code', issuingStateCode || null);
    set('address_zip', parsed.zip);
    set('address_city', parsed.city);
    set('address_line', parsed.address_line);
  }

  /**
   * Keeps only the `address_*` keys in scannedGuestData, discarding every identity /
   * document / scan-record field (incl. the seeded doc_reader_scanned_document_id). Used
   * for address cards so the emitted scan result carries nothing identity-like.
   */
  private stripToAddressFields() {
    for (const key of Object.keys(this.scannedGuestData)) {
      if (!key.startsWith('address_')) delete this.scannedGuestData[key];
    }
  }

  private fixNameFields() {
    let clientFirstName: string = this.scannedGuestData['first_name'].value;
    let clientLastName: string = this.scannedGuestData['last_name'].value;
    let fullName: string = this.scannedGuestData['full_name'].value;
    let clientMiddleName: string = '';
    if (clientFirstName == null && clientLastName == null) {
      let names = fullName.split(' ');
      clientFirstName = '';
      clientLastName = '';
      if (names.length > 2) {
        for (const i in names) {
          if (i < '2') {
            clientFirstName += ' ' + names[i];
          } else {
            clientLastName += ' ' + names[i];
          }
        }
      } else {
        clientFirstName += ' ' + names[1];
        clientLastName += ' ' + names[0];
      }

      clientFirstName = clientFirstName.trim();
      clientLastName = clientLastName.trim();
      fullName = clientFirstName + ' ' + clientLastName;
    } else {
      clientFirstName = fullName.slice(-clientFirstName.length).trim();
      clientLastName = fullName
        .slice(0, fullName.length - clientFirstName.length)
        .trim();
      fullName = clientFirstName + ' ' + clientLastName;
    }

    if (this.scannedGuestData.hasOwnProperty('middle_name')) {
      clientMiddleName = this.scannedGuestData['middle_name'].value;
      const splittedLastName = clientLastName.split(' ');
      if (clientMiddleName == null) {
        if (splittedLastName.length > 1) {
          clientMiddleName = splittedLastName[1].trim();
        }
        clientLastName = splittedLastName[0].trim();
      } else {
        clientLastName = splittedLastName[0].trim();
      }
      this.scannedGuestData['middle_name'] = {
        value: clientMiddleName,
        formatted_value: clientMiddleName,
        modified: false,
        error: false,
      };
    }

    this.scannedGuestData['first_name'] = {
      value: clientFirstName,
      formatted_value: clientFirstName,
      modified: false,
      error: false,
    };
    this.scannedGuestData['last_name'] = {
      value: clientLastName,
      formatted_value: clientLastName,
      modified: false,
      error: false,
    };
    this.scannedGuestData['full_name'] = {
      value: fullName,
      formatted_value: fullName,
      modified: false,
      error: false,
    };
  }

  private alterDocNumber(fieldValue: string | null): string | null {
    if (fieldValue == '392018EA') {
      fieldValue = '123456AA';
    }
    if (fieldValue == '836909UE') {
      fieldValue = '123456BB';
    }
    if (fieldValue == 'CW911175') {
      fieldValue = '123456CC';
    }
    return fieldValue;
  }

  private alterPersonalData() {
    if (
      this.scannedGuestData.hasOwnProperty('document_number') &&
      this.scannedGuestData['document_number'].value == '123456AA'
    ) {
      if (this.scannedGuestData.hasOwnProperty('mother_name')) {
        this.scannedGuestData['mother_name'].value = 'Test Mother';
        this.scannedGuestData['mother_name'].formatted_value = 'Test Mother';
      }
      if (this.scannedGuestData.hasOwnProperty('birth_date')) {
        this.scannedGuestData['birth_date'].value = '2000-01-01';
        this.scannedGuestData['birth_date'].formatted_value = '2000-01-01';
      }
      if (this.scannedGuestData.hasOwnProperty('birth_place')) {
        this.scannedGuestData['birth_place'].value = 'Baja';
        this.scannedGuestData['birth_place'].formatted_value = 'Baja';
      }
    }

    if (
      this.scannedGuestData.hasOwnProperty('document_number') &&
      this.scannedGuestData['document_number'].value == '123456BB'
    ) {
      if (this.scannedGuestData.hasOwnProperty('mother_name')) {
        this.scannedGuestData['mother_name'].value = 'Test Mother BB';
        this.scannedGuestData['mother_name'].formatted_value = 'Test Mother BB';
      }
      if (this.scannedGuestData.hasOwnProperty('birth_date')) {
        this.scannedGuestData['birth_date'].value = '1980-01-01';
        this.scannedGuestData['birth_date'].formatted_value = '1980-01-01';
      }
      if (this.scannedGuestData.hasOwnProperty('birth_place')) {
        this.scannedGuestData['birth_place'].value = 'Bp';
        this.scannedGuestData['birth_place'].formatted_value = 'Bp';
      }
    }

    if (
      this.scannedGuestData.hasOwnProperty('document_number') &&
      this.scannedGuestData['document_number'].value == '123456CC'
    ) {
      if (this.scannedGuestData.hasOwnProperty('mother_name')) {
        this.scannedGuestData['mother_name'].value = 'Test Mother CC';
        this.scannedGuestData['mother_name'].formatted_value = 'Test Mother CC';
      }
      if (this.scannedGuestData.hasOwnProperty('birth_date')) {
        this.scannedGuestData['birth_date'].value = '1970-01-01';
        this.scannedGuestData['birth_date'].formatted_value = '1970-01-01';
      }
      if (this.scannedGuestData.hasOwnProperty('birth_place')) {
        this.scannedGuestData['birth_place'].value = 'Bp 8ker';
        this.scannedGuestData['birth_place'].formatted_value = 'Bp 8ker';
      }
    }
  }

  private readRfid() {
    console.log('readRfid called');

    this.reader.rfid(new RFIDConfig(this.handleCompletion.bind(this)));
  }

  private shouldRfid(results: Results | null) {
    return (
      this.doRfid &&
      !this.isReadingRfid &&
      results != null &&
      results.chipPage != 0
    );
  }

  private async initialize(): Promise<boolean> {
    console.log('DocumentReaderService initialize');
    let isReady = await this.reader.isReady();
    console.log('DocumentReaderService reader.isReady()', isReady);

    if (!isReady) {
      let status = await this.reader.status();
      console.log('DocumentReaderService reader.status()', status);
      // if (isReady) return true;

      var [success, error] = await this.reader.prepareDatabase(
        'Full',
        console.log,
      );
      this.handleException(error);
      console.log('DocumentReaderService prepareDatabase success', success);

      this._readerStatus.set(ReaderStatus.INIT);

      const license = await this.readLicense();
      // console.log('DocumentReaderService initialize license', license);
      const config = new InitConfig(license);
      config.delayedNNLoad = true;

      const [success_init, error_init] = await this.reader.initialize(config);

      this.handleException(error_init);
      console.log('DocumentReaderService initialize success', success_init);
    }

    await this.initializeFields();

    return true;
  }

  private async initializeFields() {
    let initValue = {
      value: null,
      formatted_value: null,
      modified: false,
      error: false,
    };
    console.log(
      'DocumentReaderService initializeFields this.fieldsToScan',
      this.fieldsToScan,
    );
    if (!this.fieldsToScan || this.fieldsToScan.length == 0) {
      this.fieldsToScan = await this.docuscanService.fetchScanFields().then();
    }
    console.log(
      'DocumentReaderService initializeFields this.fieldsToScan after fetch',
      this.fieldsToScan,
    );

    for (const i of this.fieldsToScan) {
      this.scannedGuestData[i.name] = initValue;
    }

    this.scannedGuestData['guest_id'] = initValue;
    this.scannedGuestData['reservation_guest_id'] = initValue;
    this.scannedGuestData['doc_reader_scanned_document_id'] = initValue;
  }

  private handleException(error: DocReaderException | null) {
    if (error) {
      this._readerStatus.set(ReaderStatus.ERROR);
      console.error('handleException', error);
      Sentry.captureException(error, { tags: { 'regula.phase': 'exception' } });
    }
  }

  private async readLicense(): Promise<string> {
    try {
      const res = await fetch('assets/regula.license');
      // console.log('readLicense res', res);
      const blob = await res.blob();
      // console.log('readLicense blob', blob);

      const data: string = await new Promise((resolve, reject) => {
        const reader = DocumentReaderService.getFileReader();
        // console.log('readLicense reader', reader);
        reader.onload = () => {
          let result = reader.result as string;
          result = result.substring(result.indexOf(',') + 1);
          // console.log('readLicense result', result);
          resolve(result);
        };

        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      return data;
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  toggleRfid() {
    this.doRfid = !this.doRfid;
    console.log('toggleRfid this.doRfid', this.doRfid);
  }

  setScenario(s: string) {
    this.selectedScenario = s as Scenario;
  }

  clearResults() {
    this._readerStatus.set(ReaderStatus.READY);
  }

  /**
   * Wipes ALL state from a previous scan so the next one is a 100% clean start:
   * page counter, accumulated field data, and the emitted result signal (which the
   * guest-detail preview reads). Call before every new scan session.
   */
  resetScanSession() {
    this.pagesScanned = 0;
    this.scannedGuestData = {};
    this.documentData = {
      document_type: '',
      scan_type: '',
      date_of_issue: '',
      message: '',
    };
    this._scanResult.set({ documentData: null, scannedData: null });
  }

  private static getFileReader(): FileReader {
    const fileReader = new FileReader();
    return (fileReader as any).__zone_symbol__originalInstance;
  }

  getReaderStatusKey(status: ReaderStatus): string {
    for (const key in ReaderStatus) {
      if ((ReaderStatus as any)[key] === status) {
        return key;
      }
    }
    return 'Unknown status';
  }

  private getReaderActionKey(action: DocReaderAction): string {
    // return Object.keys(action).find(
    //     key => action[key] === 2
    //   )
    for (const key in DocReaderAction) {
      if ((DocReaderAction as any)[key] === action) {
        return key;
      }
    }
    return 'Unknown Action';
  }
}

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
// 1

// export async function loadAsset(path: string): Promise<string> {
//     var dir = await File.resolveDirectoryUrl(File.applicationDirectory + "www/assets")
//     var fileEntry = await File.getFile(dir, path, null)
//     var result = await new Promise<string>((resolve, _) => {
//         fileEntry.file(file => {
//             var reader = new FileReader()
//             reader.onloadend = (_) => resolve(reader.result as string)
//             reader.readAsDataURL(file)
//         })
//     })
// }
