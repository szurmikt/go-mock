import { Component, ViewChild, inject, signal, OnInit } from '@angular/core';
import { IonContent } from '@ionic/angular/standalone';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { AuthService } from '../../services/auth';
import { FilterService } from '../../services/home-filter.service';
import { HomeFilter, FilterSort } from '../../models/home-filter.interface';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { FilterEditorSheetComponent } from '../../components/filter-editor-sheet/filter-editor-sheet.component';

const SORT_SUMMARY_KEY: Record<FilterSort, string> = {
  room: 'filterEditor.sortRoom',
  name: 'filterEditor.sortName',
  created: 'filterEditor.sortCreated',
};

@Component({
  selector: 'app-manage-filters',
  templateUrl: './manage-filters.page.html',
  standalone: true,
  imports: [IonContent, DragDropModule, TranslatePipe, FilterEditorSheetComponent],
})
export class ManageFiltersPage implements OnInit {
  @ViewChild('editor') editor!: FilterEditorSheetComponent;

  auth = inject(AuthService);
  filterSvc = inject(FilterService);

  async ngOnInit(): Promise<void> {
    // Defensive — Home already seeds on entry, but Manage Filters can in principle be
    // reached (e.g. a deep link) before Home ever ran. ensureSeeded is idempotent.
    await this.filterSvc.ensureSeeded(this.auth.userId());
  }

  back(): void {
    window.history.back();
  }

  openNew(): void {
    this.editor.open();
  }

  openEdit(filter: HomeFilter): void {
    this.editor.open(filter);
  }

  canDelete(): boolean {
    return this.filterSvc.filters(this.auth.userId()).length > 1;
  }

  // Deletion is irreversible (no undo anywhere in this flow) and the delete icon sits right
  // next to the row's own tap target (openEdit) and the drag handle — a confirm step guards
  // against a mis-tap destroying a filter the user meant to keep.
  pendingDelete = signal<HomeFilter | null>(null);

  requestDelete(filter: HomeFilter): void {
    if (!this.canDelete()) return;
    this.pendingDelete.set(filter);
  }

  cancelDelete(): void {
    this.pendingDelete.set(null);
  }

  async confirmDelete(): Promise<void> {
    const filter = this.pendingDelete();
    if (!filter) return;
    this.pendingDelete.set(null);
    await this.filterSvc.deleteFilter(this.auth.userId(), filter.id);
  }

  summaryKey(filter: HomeFilter): string {
    return SORT_SUMMARY_KEY[filter.sort];
  }

  async drop(event: CdkDragDrop<HomeFilter[]>): Promise<void> {
    const userId = this.auth.userId();
    const filters = [...this.filterSvc.filters(userId)];
    moveItemInArray(filters, event.previousIndex, event.currentIndex);
    await this.filterSvc.reorderFilters(userId, filters.map(f => f.id));
  }
}
