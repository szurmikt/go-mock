import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, AlertController } from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth';
import { OptionsService } from '../../services/options.service';
import { PropertyInterface } from '../../models/property.interface';

@Component({
  selector: 'app-property-select',
  templateUrl: './property-select.page.html',
  styleUrls: ['./property-select.page.scss'],
  standalone: true,
  imports: [IonContent],
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
      this.properties = await this.auth.loadProperties();
    } catch {
      const alert = await this.alertCtrl.create({
        header: 'Could not load properties',
        message: 'Please check your connection and try again.',
        buttons: ['OK'],
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
