import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, AlertController } from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth';
import { OptionsService } from '../../services/options.service';
import { LanguageService } from '../../services/language.service';
import { PropertyInterface } from '../../models/property.interface';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-property-select',
  templateUrl: './property-select.page.html',
  styleUrls: ['./property-select.page.scss'],
  standalone: true,
  imports: [IonContent, TranslatePipe],
})
export class PropertySelectPage implements OnInit {
  properties: PropertyInterface[] = [];
  loading = true;
  /**
   * True while select() is resolving the property's live-update channel and checking for a
   * bundle against it — this is the first moment that channel is known, so it's also the first
   * chance to apply a pending update without waiting for a 90s+ resume (see AuthService.
   * selectProperty()). That check can take a couple of seconds, so this needs its own visible
   * state — silently blocking the tap would look like the app hung.
   */
  selecting = false;
  query = '';

  constructor(
    private auth: AuthService,
    private router: Router,
    private alertCtrl: AlertController,
    private options: OptionsService,
    private lang: LanguageService,
  ) {}

  get filteredProperties(): PropertyInterface[] {
    const q = this.query.trim().toLowerCase();
    if (!q) return this.properties;
    return this.properties.filter(p =>
      (p.property_name ?? '').toLowerCase().includes(q) ||
      (p.property_company_name ?? '').toLowerCase().includes(q) ||
      String(p.property_id).includes(q),
    );
  }

  clearQuery() {
    this.query = '';
  }

  async ngOnInit() {
    await this.loadProperties();
  }

  async loadProperties() {
    this.loading = true;
    try {
      const properties = await this.auth.loadProperties();
      // The API excludes ineligible PIDs from this response entirely — an empty
      // list means the user has no Go-eligible property.
      if (properties.length === 0) {
        await this.router.navigate(['/go-unavailable'], { replaceUrl: true });
        return;
      }
      this.properties = properties;
    } catch {
      const alert = await this.alertCtrl.create({
        header: this.lang.t('errors.loadPropertiesTitle'),
        message: this.lang.t('errors.loadPropertiesMessage'),
        buttons: [this.lang.t('common.ok')],
      });
      await alert.present();
    } finally {
      this.loading = false;
    }
  }

  async select(property: PropertyInterface) {
    const current = this.auth.selectedProperty();
    if (current?.property_id !== property.property_id) {
      this.options.clear();
    }
    this.selecting = true;
    try {
      // May apply a live-update bundle and reload the webview entirely (see
      // AuthService.selectProperty()) — everything after this line can be interrupted mid-flight
      // by that reload, which is fine: the fresh boot re-derives the same destination from the
      // property already persisted inside selectProperty(), so nothing here needs to complete.
      const eligibility = await this.auth.selectProperty(property);
      if (eligibility === 'ineligible') {
        await this.router.navigate(['/go-unavailable'], { replaceUrl: true });
        return;
      }
      if (eligibility === 'unverified') {
        await this.router.navigate(['/service-unavailable'], { replaceUrl: true });
        return;
      }
      if (this.options.countries().length === 0) {
        try { await this.options.load(); } catch { /* non-fatal */ }
      }
      await this.router.navigate(['/home'], { replaceUrl: true });
    } finally {
      this.selecting = false;
    }
  }
}
