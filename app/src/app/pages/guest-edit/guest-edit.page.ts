import { Component, OnInit, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { ReservationService } from '../../services/reservation';
import { GuestInterface } from '../../models/guest.interface';
import { OptionsService } from '../../services/options.service';
import { DocuscanService } from 'src/app/services/docuscan';
import { MixpanelService } from '../../services/mixpanel';
import { AuthService } from '../../services/auth';
import { toInputDate } from '../../utils/date';

@Component({
  selector: 'app-guest-edit',
  templateUrl: './guest-edit.page.html',
  styleUrls: ['./guest-edit.page.scss'],
  standalone: true,
  imports: [IonContent, FormsModule],
})
export class GuestEditPage implements OnInit {
  private docuscanService = inject(DocuscanService);

  guest = signal<GuestInterface | null>(null);
  loading = signal(true);
  saving = signal(false);
  error = signal<string | null>(null);
  saveError = signal<string | null>(null);

  // form model — flat, two-way bound
  form = {
    first_name: '',
    last_name: '',
    maiden_name: '',
    mother_name: '',
    birth_date: '',
    birth_place: '',
    citizenship: '',
    gender: '',
    phone_number: '',
    email: '',
    zip: '',
    city: '',
    country_code: '',
    address_line: '',
    document_type: '',
    document_number: '',
  };

  private reservationCode!: string;
  private guestId!: string;

  // Analytics: whether this edit was prefilled from a scan, and a snapshot of the
  // (possibly scan-prefilled) form so save() can count how many fields changed.
  private fromScan = false;
  private formSnapshot: Record<string, string> = {};

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private res: ReservationService,
    public options: OptionsService,
    private mixpanel: MixpanelService,
    private auth: AuthService,
  ) {}

  async ngOnInit() {
    this.reservationCode = this.route.snapshot.paramMap.get('code')!;
    this.guestId = this.route.snapshot.paramMap.get('guestId')!;

    try {
      // Force a fresh fetch so the edit form always starts from the latest server copy
      // (bypasses the 60s SWR window) — guards against editing/overwriting a stale guest.
      const guests = await this.res.fetchGuests(this.reservationCode, true);
      const found = guests.find(
        (g: GuestInterface) => g.reservation_guest_id === this.guestId,
      );
      if (!found) {
        this.error.set('Guest not found');
        return;
      }
      this.guest.set(found);
      this.form = {
        first_name: found.first_name ?? '',
        last_name: found.last_name ?? '',
        maiden_name: found.maiden_name ?? '',
        mother_name: found.mother_name ?? '',
        birth_date: found.birth_date ?? '',
        birth_place: found.birth_place ?? '',
        citizenship: found.citizenship ?? '',
        gender: found.gender ?? '',
        phone_number: found.phone_number ?? '',
        email: found.email ?? '',
        zip: found.address?.zip ?? '',
        city: found.address?.city ?? '',
        country_code: found.address?.country_code ?? '',
        address_line: found.address?.address_line ?? '',
        document_type: found.document?.document_type ?? '',
        document_number: found.document?.document_number ?? '',
      };
      const last = this.docuscanService.lastScanResult;
      if (last != null && last.scannedData != null) {
        this.fromScan = true;
        const isIdentityDoc = last.documentData?.is_identity_document !== false;
        const scanned = this.docuscanService.scannedDataToGuestScannedData(
          last.scannedData!,
        );
        // Only an identity scan marks the guest as scanned. For an address card we leave
        // found.scanned_data at its fetched value (real ID record or null), so save()'s
        // `...g` spread sends the POST /guest scanned_data section unchanged.
        if (isIdentityDoc) {
          found.scanned_data = scanned;
        }
        const sd = isIdentityDoc ? found.scanned_data : scanned;
        if (sd) {
          this.form.first_name = sd.first_name ?? this.form.first_name;
          this.form.last_name = sd.last_name ?? this.form.last_name;
          this.form.maiden_name = sd.maiden_name ?? this.form.maiden_name;
          this.form.mother_name = sd.mother_name ?? this.form.mother_name;
          // Normalize to strict YYYY-MM-DD: <input type="date"> silently rejects
          // any other shape, leaving the field blank.
          this.form.birth_date =
            toInputDate(sd.birth_date) || this.form.birth_date;
          this.form.birth_place = sd.birth_place ?? this.form.birth_place;
          this.form.citizenship = sd.citizenship ?? this.form.citizenship;
          this.form.gender = (sd.gender ?? this.form.gender).toLowerCase();
          this.form.document_type = (
            sd.document?.document_type ?? this.form.document_type
          ).toLowerCase();
          this.form.document_number =
            sd.document?.document_number ?? this.form.document_number;
          // Address card (lakcímkártya): prefill the address fields too. Nested
          // under scanned_data.address by scannedDataToGuestScannedData; absent
          // for identity docs, so this keeps the existing values then.
          const addr = sd.address;
          if (addr) {
            this.form.zip = addr.zip ?? this.form.zip;
            this.form.city = addr.city ?? this.form.city;
            this.form.country_code = addr.country_code ?? this.form.country_code;
            this.form.address_line = addr.address_line ?? this.form.address_line;
          }
        }
      }
      // Snapshot the (possibly scan-prefilled) form so save() can count changes.
      this.formSnapshot = { ...this.form };
    } catch (e: any) {
      this.error.set(e.message ?? 'Failed to load guest');
    } finally {
      this.loading.set(false);
    }
  }

  async save() {
    const g = this.guest();
    if (!g) return;
    this.saving.set(true);
    this.saveError.set(null);
    try {
      const updated: GuestInterface = {
        ...g,
        first_name: this.form.first_name,
        last_name: this.form.last_name,
        maiden_name: this.form.maiden_name,
        mother_name: this.form.mother_name,
        birth_date: this.form.birth_date,
        birth_place: this.form.birth_place,
        citizenship: this.form.citizenship,
        gender: this.form.gender,
        phone_number: this.form.phone_number,
        email: this.form.email,
        address: {
          country_code: this.form.country_code,
          zip: this.form.zip,
          city: this.form.city,
          address_line: this.form.address_line,
        },
        document: {
          document_type: this.form.document_type,
          document_number: this.form.document_number,
          date_of_issue_of_the_document:
            g.document?.date_of_issue_of_the_document ?? '',
        },
      };
      await this.res.updateGuest(this.reservationCode, updated);
      const fieldsChanged = Object.keys(this.form).filter(
        k => (this.form as Record<string, string>)[k] !== (this.formSnapshot[k] ?? ''),
      ).length;
      this.mixpanel.trackGuestUpdated({
        reservation_code: this.reservationCode,
        property_id: this.auth.selectedProperty()?.property_id,
        from_scan: this.fromScan,
        fields_changed: fieldsChanged,
      });
      this.router.navigate(['..'], {
        relativeTo: this.route,
        replaceUrl: true,
      });
    } catch (e: any) {
      this.saveError.set(e.message ?? 'Failed to save');
    } finally {
      this.saving.set(false);
    }
  }

  back() {
    window.history.back();
  }

  isScannedSource(field: 'first_name' | 'last_name' | 'maiden_name' | 'mother_name'): boolean {
    const scanned = this.guest()?.scanned_data?.[field];
    if (!scanned) return false;
    return this.form[field] === scanned;
  }
}
