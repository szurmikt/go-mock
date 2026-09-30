import { Component, EventEmitter, Output, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth';
import { FilterService } from '../../services/home-filter.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { FilterDay, FilterGuests, FilterSort, HomeFilter } from '../../models/home-filter.interface';
import { autoFilterName } from '../../utils/filter-name';

type Mode = 'create' | 'edit';

@Component({
  selector: 'app-filter-editor-sheet',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  templateUrl: './filter-editor-sheet.component.html',
})
export class FilterEditorSheetComponent {
  private auth = inject(AuthService);
  private filterSvc = inject(FilterService);

  /** Fired after a successful save — ManageFiltersPage doesn't strictly need this (the
   *  filter list already re-renders reactively off FilterService's store signal), but it's
   *  a cheap, explicit hook for anything that wants to react to "a save just happened". */
  @Output() saved = new EventEmitter<void>();

  readonly guestsOptions: FilterGuests[] = ['arrivals', 'departures', 'in_house'];
  readonly dayOptions: FilterDay[] = ['yesterday', 'today', 'tomorrow', 'next_7_days', 'next_14_days'];
  readonly sortOptions: FilterSort[] = ['room', 'name', 'created'];

  visible = signal(false);
  mode = signal<Mode>('create');
  private editingId: string | null = null;

  guests = signal<FilterGuests>('arrivals');
  day = signal<FilterDay>('today');
  sort = signal<FilterSort>('room');
  name = signal('');
  nameEdited = signal(false);

  readonly title = computed(() => (this.mode() === 'create' ? 'filterEditor.titleNew' : 'filterEditor.titleEdit'));

  /** The auto-generated name keeps tracking guests/day until the user types in the Name
   *  field — see HomeFilter.nameEdited's doc comment. */
  readonly displayName = computed(() =>
    this.nameEdited() ? this.name() : autoFilterName(this.guests(), this.day()),
  );

  /** Guests = In-house locks Day to Today; every other Day option is disabled, not hidden —
   *  the user can see what's unavailable rather than wondering where it went. */
  readonly dayLocked = computed(() => this.guests() === 'in_house');

  open(filter?: HomeFilter): void {
    if (filter) {
      this.mode.set('edit');
      this.editingId = filter.id;
      this.guests.set(filter.guests);
      this.day.set(filter.day);
      this.sort.set(filter.sort);
      this.name.set(filter.name);
      this.nameEdited.set(filter.nameEdited);
    } else {
      this.mode.set('create');
      this.editingId = null;
      this.guests.set('arrivals');
      this.day.set('today');
      this.sort.set('room');
      this.name.set('');
      this.nameEdited.set(false);
    }
    this.visible.set(true);
  }

  close(): void {
    this.visible.set(false);
  }

  setGuests(g: FilterGuests): void {
    this.guests.set(g);
    if (g === 'in_house') this.day.set('today');
  }

  setDay(d: FilterDay): void {
    if (this.dayLocked()) return;
    this.day.set(d);
  }

  setSort(s: FilterSort): void {
    this.sort.set(s);
  }

  onNameInput(value: string): void {
    this.name.set(value);
    this.nameEdited.set(true);
  }

  guestsLabelKey(g: FilterGuests): string {
    return { arrivals: 'filterEditor.guestsArrivals', departures: 'filterEditor.guestsDepartures', in_house: 'filterEditor.guestsInHouse' }[g];
  }

  dayLabelKey(d: FilterDay): string {
    return {
      yesterday: 'filterEditor.dayYesterday',
      today: 'filterEditor.dayToday',
      tomorrow: 'filterEditor.dayTomorrow',
      next_7_days: 'filterEditor.dayNext7',
      next_14_days: 'filterEditor.dayNext14',
    }[d];
  }

  sortLabelKey(s: FilterSort): string {
    return { room: 'filterEditor.sortRoom', name: 'filterEditor.sortName', created: 'filterEditor.sortCreated' }[s];
  }

  async save(): Promise<void> {
    const userId = this.auth.userId();
    if (!userId) return;
    // A manually-cleared name field falls back to the auto name rather than saving blank.
    const trimmed = this.name().trim();
    const finalName = this.nameEdited() && trimmed ? trimmed : autoFilterName(this.guests(), this.day());
    const finalNameEdited = this.nameEdited() && trimmed.length > 0;
    const draft = {
      guests: this.guests(),
      day: this.day(),
      sort: this.sort(),
      name: finalName,
      nameEdited: finalNameEdited,
    };
    if (this.mode() === 'edit' && this.editingId) {
      const existing = this.filterSvc.filters(userId).find(f => f.id === this.editingId);
      if (existing) await this.filterSvc.updateFilter(userId, { ...existing, ...draft });
    } else {
      await this.filterSvc.createFilter(userId, draft);
    }
    this.saved.emit();
    this.close();
  }
}
