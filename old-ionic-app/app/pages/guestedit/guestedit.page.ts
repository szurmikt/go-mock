import {
  ApplicationRef,
  Component,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { NavController } from '@ionic/angular';
import { FormGroup, FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  ModalController,
  IonButton,
  IonInput,
  IonSelectOption,
  IonSelect,
  IonIcon,
  IonSpinner,
} from '@ionic/angular/standalone';
import { Subscription } from 'rxjs';
import { formatDate, NgClass } from '@angular/common';
import { addIcons } from 'ionicons';
import { GuestInterface } from 'src/app/models/guest.interface';
import { ReservationService } from 'src/app/services/reservation.service';
import { DateMaskDirective } from 'src/app/directives/date-mask.directive';
import { DocType } from 'src/app/models/doc-type.interface';
import { CustomBackButtonComponent } from 'src/app/components/custom-back-button/custom-back-button.component';
import { DocuscanService } from 'src/app/services/docuscan.service';
import { AuthService } from 'src/app/services/auth.service';
import { OptionsService } from 'src/app/services/options.service';
import { BootstrapService } from 'src/app/services/bootstrap.service';
import { TranslatePipe } from 'src/app/pipes/translate.pipe';

@Component({
  selector: 'app-guest',
  templateUrl: './guestedit.page.html',
  styleUrls: ['./guestedit.page.scss'],
  standalone: true,
  imports: [
    IonSpinner,
    IonInput,
    IonButton,
    IonButtons,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    ReactiveFormsModule,
    NgClass,
    CustomBackButtonComponent,
    IonSelectOption,
    IonSelect,
    TranslatePipe,
  ],
})
export class GuestEditPage implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  appRef = inject(ApplicationRef);
  bootstrapService = inject(BootstrapService);
  docuscanService = inject(DocuscanService);
  reservationService = inject(ReservationService);
  optionsService = inject(OptionsService);
  authService = inject(AuthService);
  modalCtrl = inject(ModalController);
  router = inject(Router);
  navController = inject(NavController);

  guest: GuestInterface | undefined;

  guestForm = new FormGroup({
    first_name: new FormControl(''),
    last_name: new FormControl(''),
    maiden_name: new FormControl(''),
    mother_name: new FormControl(''),
    birth_date: new FormControl(''),
    birth_date_formatted: new FormControl(''),
    birth_place: new FormControl(''),
    citizenship: new FormControl(''),
    citizenship_formatted: new FormControl(''),
    gender: new FormControl(''),
    gender_formatted: new FormControl(''),
    phone_number: new FormControl(''),
    email: new FormControl(''),
    document_type: new FormControl(''),
    document_type_formatted: new FormControl(''),
    document_number: new FormControl(''),
  });

  dataSubscription!: Subscription;
  bootstrapSubscription!: Subscription;

  reservationGuestId: string | null = '';
  reservationCode: string | null = '';

  fabOpened = false;
  dateOpened = false;

  dateFormat = 'yyyy. MM. dd.';
  dateLocal = 'EN';

  docTypes: DocType[] = [];

  options: { gender: any; document_type: any; country: any } | null = null;
  // documentTypes: { [key: string]: string } = {};
  documentTypeOptions: { value: string; title: string }[] = [];
  genderOptions: { value: string; title: string }[] = [];
  citizenshipOptions: { id: number; name: string; country_code: string }[] = [];

  @ViewChild('docTypeRef', { read: ElementRef, static: false })
  docTypeRef!: ElementRef;

  @ViewChild('docTypeSelectRef', { read: ElementRef, static: false })
  docTypeSelectRef!: ElementRef;

  @ViewChild('genderRef', { read: ElementRef, static: false })
  genderRef!: ElementRef;

  @ViewChild('genderSelectRef', { read: ElementRef, static: false })
  genderSelectRef!: ElementRef;

  @ViewChild('citizenshipRef', { read: ElementRef, static: false })
  citizenshipRef!: ElementRef;

  @ViewChild('citizenshipSelectRef', { read: ElementRef, static: false })
  citizenshipSelectRef!: ElementRef;

  @ViewChild('testRef')
  testRef!: ElementRef;

  initialized = false;
  savingInProgress = false;

  constructor() {
    this.reservationGuestId =
      this.route.snapshot.paramMap.get('reservationGuestId');
    console.log(
      'guestEdit constructor this.reservationGuestId',
      this.reservationGuestId,
    );

    this.reservationCode = this.route.snapshot.paramMap.get('reservationCode');
    console.log(
      'guestEdit constructor this.reservationCode',
      this.reservationCode,
    );

    addIcons({
      call: 'assets/icon/icon-call.svg',
      mail: 'assets/icon/icon-mail.svg',
    });
  }

  ngOnInit() {
    this.bootstrapSubscription = this.bootstrapService.bootstrapBS.subscribe(
      (initialized) => {
        this.initialized = initialized;
        console.log(
          'bootstrapBS.subscribe this.initialized',
          this.initialized,
          this.bootstrapService.getOptions(),
          this.optionsService.get(),
        );
        if (this.initialized) {
          this.loadGuestData();
        }
      },
    );
    // this.authService.onReady().then(async () => {
    //   // this.docTypes = this.reservationService.getDocTypes();
    // this.options = await this.optionsService.get();
    // if (this.options) {
    //   this.documentTypeOptions = Object.entries(
    //     this.options.document_type,
    //   ).map(([key, value]) => ({
    //     value: key,
    //     title: value as string,
    //   }));
    //   this.genderOptions = Object.entries(this.options.gender).map(
    //     ([key, value]) => ({
    //       value: key,
    //       title: value as string,
    //     }),
    //   );
    //   this.citizenshipOptions = this.options.country;
    //   }

    //   console.log('guestEdit ngOnInit this.options', this.options);
    //   // this.documentTypes = this.options?.document_type ?? {};

    //   this.reservationService.fetchGuestById(
    //     this.reservationCode!,
    //     this.reservationGuestId!,
    //   );

    //   this.reservationService.guestBS.subscribe((guest) => {
    //     this.guest = guest;
    //     this.loadGuestData();
    //   });
    // });
  }

  async loadGuestData() {
    this.options = this.bootstrapService.getOptions();
    console.log('guestEdit loadGuestData this.options', this.options);
    if (this.options) {
      this.documentTypeOptions = Object.entries(this.options.document_type).map(
        ([key, value]) => ({
          value: key,
          title: value as string,
        }),
      );
      this.genderOptions = Object.entries(this.options.gender).map(
        ([key, value]) => ({
          value: key,
          title: value as string,
        }),
      );
      this.citizenshipOptions = this.options.country;
    }

    this.guest = await this.reservationService.fetchGuestById(
      this.reservationCode!,
      this.reservationGuestId!,
    );

    console.log('guestEdit loadGuestData this.guest', this.guest);
    console.log(
      'guestEdit loadGuestData this.docuscanService.lastScannedData',
      this.docuscanService.lastScannedData,
    );
    let copyScannedData = false;
    if (
      this.docuscanService.lastScannedData &&
      this.docuscanService.lastScannedData?.document?.document_type
    ) {
      this.guest!.scanned_data = this.docuscanService.lastScannedData;
      copyScannedData = true;
    }

    console.log('guestEdit ngOnInit this.guest', this.guest);
    this.guestForm.get(['first_name'])!.setValue(this.guest?.first_name);
    this.guestForm.get(['last_name'])!.setValue(this.guest?.last_name);
    this.guestForm.get(['maiden_name'])!.setValue(this.guest?.maiden_name);
    this.guestForm.get(['mother_name'])!.setValue(this.guest?.mother_name);
    this.guestForm.get(['birth_date'])!.setValue(this.guest?.birth_date);

    this.guestForm.get(['birth_place'])!.setValue(this.guest?.birth_place);
    this.guestForm.get(['gender'])!.setValue(this.guest?.gender);
    this.guestForm
      .get(['gender_formatted'])!
      .setValue(this.genderTitle(this.guest?.gender));
    this.guestForm.get(['phone_number'])!.setValue(this.guest?.phone_number);
    this.guestForm.get(['email'])!.setValue(this.guest?.email);
    this.guestForm.get(['citizenship'])!.setValue(this.guest?.citizenship);
    this.guestForm
      .get(['citizenship_formatted'])!
      .setValue(this.citizenshipTitle(this.guest?.citizenship));
    this.guestForm
      .get(['document_type'])!
      .setValue(this.guest?.document?.document_type);
    this.guestForm
      .get(['document_type_formatted'])!
      .setValue(this.docTypeTitle(this.guest?.document?.document_type));
    this.guestForm
      .get(['document_number'])!
      .setValue(this.guest?.document?.document_number);

    if (copyScannedData) {
      this.copyScannedData(true);
    }

    this.appRef.tick();
  }

  ngOnDestroy() {
    console.log('GuestEditPage ngOnDestroy');
    if (this.dataSubscription) {
      this.dataSubscription.unsubscribe();
    }
    if (this.bootstrapSubscription) {
      this.bootstrapSubscription.unsubscribe();
    }
  }

  ionViewWillEnter() {
    this.initialized = this.bootstrapService.isInitialized();
    if (!this.initialized) {
      this.bootstrapService.init();
    }
  }

  dateChanged(e: any) {
    this.guestForm
      .get(['birth_date_formatted'])!
      .setValue(
        formatDate(
          this.guestForm.value.birth_date ?? '',
          this.dateFormat,
          this.dateLocal,
        ),
      );
  }

  toggleDocTypeSelect() {
    this.docTypeSelectRef.nativeElement.click();
  }

  docChanged(e: any) {
    console.log('docChanged e', e);
    this.docUpdate(e.detail.value);
  }

  docUpdate(value: string) {
    console.log('docUpdate value', value);
    this.guestForm.get(['document_type'])!.setValue(value);

    this.guestForm
      .get(['document_type_formatted'])!
      .setValue(this.docTypeTitle(value));

    this.docTypeRef.nativeElement.classList.remove('has-focus');
  }

  docTypeTitle(value: string = '') {
    return (
      this.documentTypeOptions.find((e) => e.value == value)?.title ?? 'N/A'
    );
  }

  toggleGenderSelect() {
    this.genderSelectRef.nativeElement.click();
  }

  genderChanged(e: any) {
    console.log('genderChanged e', e);
    this.genderUpdate(e.detail.value);
  }

  genderUpdate(value: string) {
    console.log('genderUpdate value', value);
    this.guestForm.get(['gender'])!.setValue(value);

    this.guestForm.get(['gender_formatted'])!.setValue(this.genderTitle(value));

    this.genderRef.nativeElement.classList.remove('has-focus');
  }

  genderTitle(value: string = '') {
    return (
      this.genderOptions.find(
        (e) => e.value.toLocaleLowerCase() == value?.toLocaleLowerCase(),
      )?.title ?? 'N/A'
    );
  }

  toggleCitizenshipSelect() {
    this.citizenshipSelectRef.nativeElement.click();
  }

  citizenshipChanged(e: any) {
    console.log('citizenshipChanged e', e);
    this.citizenshipUpdate(e.detail.value);
  }

  citizenshipUpdate(value: string) {
    console.log('citizenshipUpdate value', value);
    this.guestForm.get(['citizenship'])!.setValue(value);

    this.guestForm
      .get(['citizenship_formatted'])!
      .setValue(this.citizenshipTitle(value));

    this.citizenshipRef.nativeElement.classList.remove('has-focus');
  }

  citizenshipTitle(value: string = '') {
    return (
      this.citizenshipOptions.find((e) => e.country_code == value)?.name ??
      'N/A'
    );
  }

  save() {
    this.savingInProgress = true;
    console.log('save this.guestForm', this.guestForm.value);
    console.warn(this.guestForm.value);
    this.guest!.first_name = this.guestForm.value.first_name ?? '';
    this.guest!.last_name = this.guestForm.value.last_name ?? '';
    this.guest!.maiden_name = this.guestForm.value.maiden_name ?? '';
    this.guest!.mother_name = this.guestForm.value.mother_name ?? '';
    this.guest!.birth_date = this.guestForm.value.birth_date ?? '';
    this.guest!.birth_place = this.guestForm.value.birth_place ?? '';
    this.guest!.citizenship = this.guestForm.value.citizenship ?? '';
    this.guest!.gender = this.guestForm.value.gender ?? '';
    this.guest!.phone_number = this.guestForm.value.phone_number ?? '';
    this.guest!.email = this.guestForm.value.email ?? '';
    this.guest!.document!.document_number =
      this.guestForm.value.document_number ?? '';
    this.guest!.document!.document_type =
      this.guestForm.value.document_type ?? '';
    this.reservationService
      .updateGuest(this.reservationCode!, this.guest!)
      .then(async () => {
        console.log('GuestPage openScanModal guest updated successfully');
        // this.loadGuestData();
        await this.reservationService.fetchGuestById(
          this.reservationCode!,
          this.reservationGuestId!,
        );
        this.savingInProgress = false;
        this.navController.back();
      });
  }

  copyScannedData(override: boolean) {
    console.log('copyScannedData override', override);
    let scannedData = this.guest?.scanned_data;
    console.log('copyScannedData scannedData', scannedData);
    if (scannedData) {
      if (
        scannedData.first_name &&
        (override || !this.guestForm.value.first_name)
      )
        this.guestForm.get(['first_name'])!.setValue(scannedData.first_name);
      if (
        scannedData.last_name &&
        (override || !this.guestForm.value.last_name)
      )
        this.guestForm.get(['last_name'])!.setValue(scannedData.last_name);
      if (
        scannedData.maiden_name &&
        (override || !this.guestForm.value.maiden_name)
      )
        this.guestForm.get(['maiden_name'])!.setValue(scannedData.maiden_name);
      if (
        scannedData.mother_name &&
        (override || !this.guestForm.value.mother_name)
      )
        this.guestForm.get(['mother_name'])!.setValue(scannedData.mother_name);
      if (
        scannedData.birth_date &&
        (override || !this.guestForm.value.birth_date)
      )
        this.guestForm.get(['birth_date'])!.setValue(scannedData.birth_date);
      if (
        scannedData.birth_place &&
        (override || !this.guestForm.value.birth_place)
      )
        this.guestForm.get(['birth_place'])!.setValue(scannedData.birth_place);
      if (
        scannedData.citizenship &&
        (override || !this.guestForm.value.citizenship)
      )
        this.citizenshipUpdate(scannedData.citizenship);
      if (scannedData.gender && (override || !this.guestForm.value.gender))
        this.genderUpdate(scannedData.gender);
      if (scannedData.document) {
        if (
          scannedData.document.document_type &&
          (override || !this.guestForm.value.document_type)
        )
          // this.guestForm
          //   .get(['document_type'])!
          //   .setValue(scannedData.document.document_type);
          this.docUpdate(scannedData.document.document_type);
        if (
          scannedData.document.document_number &&
          (override || !this.guestForm.value.document_number)
        )
          this.guestForm
            .get(['document_number'])!
            .setValue(scannedData.document.document_number);
      }
    }
  }
}
