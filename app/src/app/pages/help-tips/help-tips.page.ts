import { Component, computed, inject, signal } from '@angular/core';
import { IonContent } from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth';
import { LanguageService } from '../../services/language.service';
import { TipsService } from '../../services/tips.service';
import { TipCard } from '../../models/tip-card.interface';
import { normalizeText } from '../../utils/text';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TipDetailSheetComponent } from '../../components/tip-detail-sheet/tip-detail-sheet.component';
import { TipCardComponent } from '../../components/tip-card/tip-card.component';

interface TipCardGroup {
  category: string;
  cards: TipCard[];
}

@Component({
  selector: 'app-help-tips',
  templateUrl: './help-tips.page.html',
  standalone: true,
  imports: [IonContent, TranslatePipe, TipDetailSheetComponent, TipCardComponent],
})
export class HelpTipsPage {
  tips = inject(TipsService);
  lang = inject(LanguageService);

  query = signal('');
  selectedCategory = signal<string | null>(null);

  // The full library, unfiltered by seen/dismissed state — this list is the recovery path
  // for anything dismissed from Home (see TipsService.getCards()'s doc comment). Reactive
  // reads (isSeen()) are fine here, unlike Home's carousel: a row losing its unseen dot after
  // being opened doesn't reorder or remove the row, so there's nothing disruptive to guard
  // against by snapshotting.
  private readonly allCards = this.tips.getCards();

  readonly categories = computed(() => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const c of this.allCards) {
      if (!seen.has(c.category)) {
        seen.add(c.category);
        ordered.push(c.category);
      }
    }
    return ordered;
  });

  readonly filtered = computed(() => {
    const q = normalizeText(this.query()).trim();
    const cat = this.selectedCategory();
    return this.allCards.filter(c => {
      if (cat && c.category !== cat) return false;
      if (!q) return true;
      const text = normalizeText(`${c.title} ${c.summary}`);
      return text.includes(q);
    });
  });

  readonly grouped = computed((): TipCardGroup[] => {
    const groups = new Map<string, TipCard[]>();
    for (const c of this.filtered()) {
      const arr = groups.get(c.category) ?? [];
      arr.push(c);
      groups.set(c.category, arr);
    }
    return this.categories()
      .filter(cat => groups.has(cat))
      .map(category => ({ category, cards: groups.get(category)! }));
  });

  constructor(public auth: AuthService) {}

  back() {
    window.history.back();
  }

  selectCategory(category: string | null) {
    this.selectedCategory.set(category);
  }

  /** A category with no `helpTips.category<Name>` translation key falls back to the raw
   *  (untranslated) category string, rather than rendering a literal `helpTips.categoryFoo`
   *  key — LanguageService.t() returns the raw key on a miss, which is what makes the
   *  `translated === key` check below reliable. */
  categoryLabel(category: string): string {
    const key = 'helpTips.category' + category.charAt(0).toUpperCase() + category.slice(1);
    const translated = this.lang.t(key);
    return translated === key ? category : translated;
  }
}
