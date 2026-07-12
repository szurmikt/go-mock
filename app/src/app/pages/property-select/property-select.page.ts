import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, AlertController } from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth';
import { OptionsService } from '../../services/options.service';
import { LanguageService } from '../../services/language.service';
import { PropertyGatingService } from '../../services/property-gating.service';
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
  query = '';

  constructor(
    private auth: AuthService,
    private router: Router,
    private alertCtrl: AlertController,
    private options: OptionsService,
    private lang: LanguageService,
    private propertyGating: PropertyGatingService,
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
      const allowed = await this.propertyGating.resolveEnabledPropertyIds(
        properties.map(p => p.property_id),
      );
      if (allowed === null) {
        await this.router.navigate(['/service-unavailable'], { replaceUrl: true });
        return;
      }
      if (allowed.size === 0) {
        await this.router.navigate(['/go-unavailable'], { replaceUrl: true });
        return;
      }
      this.auth.setGoEnabledPropertyIds(allowed);
      this.properties = properties.filter(p => allowed.has(p.property_id));
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
    await this.auth.selectProperty(property);
    if (this.options.countries().length === 0) {
      try { await this.options.load(); } catch { /* non-fatal */ }
    }
    await this.router.navigate(['/home'], { replaceUrl: true });
  }
}
