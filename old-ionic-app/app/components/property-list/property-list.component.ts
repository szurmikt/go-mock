import { Component, inject, OnInit } from '@angular/core';
import { NavParams } from '@ionic/angular';
import { PropertyInterface } from '../../models/property.interface';
import { Events } from '../../services/event.service';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import {
  ModalController,
  IonInput,
  IonButton,
  IonGrid,
  IonRow,
  IonCol,
} from '@ionic/angular/standalone';
import { AsyncPipe } from '@angular/common';
import { Router } from '@angular/router';
import { TranslatePipe } from 'src/app/pipes/translate.pipe';
import { LanguageSwitcherComponent } from '../language-switcher/language-switcher.component';
import { LanguageService } from 'src/app/services/languages/language.service';

@Component({
  selector: 'app-property-list',
  templateUrl: './property-list.component.html',
  styleUrls: ['./property-list.component.scss'],
  imports: [
    IonCol,
    IonRow,
    IonGrid,
    IonButton,
    IonInput,
    TranslatePipe,
    // LanguageSwitcherComponent,
    AsyncPipe,
  ],
  standalone: true,
})
export class PropertyListComponent implements OnInit {
  userService = inject(UserService);
  events = inject(Events);
  authService = inject(AuthService);
  modalCtrl = inject(ModalController);
  navParams = inject(NavParams);
  router: Router = inject(Router);
  languageService = inject(LanguageService);

  properties: PropertyInterface[] = [];
  filteredData: PropertyInterface[] = this.properties;
  showSuperAdminSearch: boolean = false;
  searchVal: any = '';

  private readonly logOut: boolean = false;

  constructor() {
    this.filteredData = this.properties = this.navParams.get('list');
    this.logOut = this.navParams.get('logout');
    this.showSuperAdminSearch = this.authService.hasScope('superadmin');
  }

  ngOnInit() {}

  logoutUser() {
    console.log('PropertyListComponent logoutUser');

    this.userService.logout().subscribe({
      next: (_) => {
        this.modalCtrl.dismiss();
        this.router.navigate(['login']).then();
      },
      error: (error) => {},
    });
  }

  close() {
    this.modalCtrl.dismiss();
  }

  changeProperty(property: PropertyInterface) {
    console.log('PropertylistComponent changeProperty');

    this.userService.setProperty(property.property_id);

    let acc = this.userService.getProperty();
    console.log('acc', acc);

    this.modalCtrl.dismiss({
      propertyId: property.property_id,
    });
  }

  cancel() {
    if (this.logOut) {
      this.events.publish('logout');
    }
    this.modalCtrl.dismiss();
  }

  filterProperties(event: any) {
    const value = event.target.value;
    this.filteredData = this.properties;
    console.log('this.filteredData ', this.filteredData);

    if (value && value.trim() !== '') {
      this.filteredData = this.filteredData.filter((item) => {
        if (
          item.property_id != null &&
          item.property_name != '' &&
          item.property_name != null
        ) {
          return (
            item.property_id
              .toString()
              .toLowerCase()
              .indexOf(value.toLowerCase()) === 0 ||
            item.property_name
              .toString()
              .toLowerCase()
              .indexOf(value.toLowerCase()) === 0
          );
        }
        return 0;
      });
    }
  }
}
