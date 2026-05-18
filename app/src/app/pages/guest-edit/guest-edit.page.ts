import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { ReservationService } from '../../services/reservation';
import { GuestInterface } from '../../models/guest.interface';
import { OptionsService } from '../../services/options.service';

@Component({
  selector: 'app-guest-edit',
  templateUrl: './guest-edit.page.html',
  styleUrls: ['./guest-edit.page.scss'],
  standalone: true,
  imports: [IonContent, FormsModule],
})
export class GuestEditPage implements OnInit {
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
    document_type: '',
    document_number: '',
  };

  private reservationCode!: string;
  private guestId!: string;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private res: ReservationService,
    public options: OptionsService,
  ) {}

  async ngOnInit() {
    this.reservationCode = this.route.snapshot.paramMap.get('code')!;
    this.guestId = this.route.snapshot.paramMap.get('guestId')!;

    try {
      const guests = await this.res.fetchGuests(this.reservationCode);
      const found = guests.find((g: GuestInterface) => g.reservation_guest_id === this.guestId);
      if (!found) { this.error.set('Guest not found'); return; }
      this.guest.set(found);
      this.form = {
        first_name:      found.first_name ?? '',
        last_name:       found.last_name ?? '',
        maiden_name:     found.maiden_name ?? '',
        mother_name:     found.mother_name ?? '',
        birth_date:      found.birth_date ?? '',
        birth_place:     found.birth_place ?? '',
        citizenship:     found.citizenship ?? '',
        gender:          found.gender ?? '',
        phone_number:    found.phone_number ?? '',
        email:           found.email ?? '',
        document_type:   found.document?.document_type ?? '',
        document_number: found.document?.document_number ?? '',
      };
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
        first_name:   this.form.first_name,
        last_name:    this.form.last_name,
        maiden_name:  this.form.maiden_name,
        mother_name:  this.form.mother_name,
        birth_date:   this.form.birth_date,
        birth_place:  this.form.birth_place,
        citizenship:  this.form.citizenship,
        gender:       this.form.gender,
        phone_number: this.form.phone_number,
        email:        this.form.email,
        document: {
          document_type:                 this.form.document_type,
          document_number:               this.form.document_number,
          date_of_issue_of_the_document: g.document?.date_of_issue_of_the_document ?? '',
        },
      };
      await this.res.updateGuest(this.reservationCode, updated);
      this.router.navigate(['..'], { relativeTo: this.route, replaceUrl: true });
    } catch (e: any) {
      this.saveError.set(e.message ?? 'Failed to save');
    } finally {
      this.saving.set(false);
    }
  }

  back() {
    window.history.back();
  }
}
