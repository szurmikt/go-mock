import { NgClass } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonIcon,
  IonList,
  IonSpinner,
} from '@ionic/angular/standalone';
import { CustomBackButtonComponent } from 'src/app/components/custom-back-button/custom-back-button.component';

@Component({
  selector: 'app-guest-feedback',
  templateUrl: './guest-feedback.page.html',
  styleUrls: ['./guest-feedback.page.scss'],
  standalone: true,
  imports: [
    IonSpinner,
    IonList,
    IonIcon,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButtons,
    CustomBackButtonComponent,
    NgClass,
    NgClass
],
})
export class GuestFeedbackPage implements OnInit {
  avarage = 9.4;
  staff = 8.2;

  segment = 'all';
  currentFeedbacktitle = 'All feedback';

  init = true;
  fetching = false;

  feedbacks = [
    {
      reservation_code: '34MRK211',
      status: 'Onboard',
      name: 'Emma Williams',
      room: 'Junior suite',
      question: 'How clean was your room?',
      answer: 3,
      needsattention: true,
    },

    {
      reservation_code: '76QWE211',
      status: 'Onboard',
      name: 'Eric Williams',
      room: 'Junior suite',
      question: 'How clean was your room?',
      answer: 10,
      needsattention: false,
    },
    {
      reservation_code: '34MRK211',
      status: 'Onboard',
      name: 'Emma Williams',
      room: 'Junior suite',
      question: 'How did you like staff?',
      answer: 8,
      needsattention: false,
    },

    {
      reservation_code: '76QWE211',
      status: 'Onboard',
      name: 'Eric Williams',
      room: 'Junior suite',
      question: 'How did you like staff?',
      answer: 2,
      needsattention: true,
    },
  ];

  filteredFeedbacks: any[] = [];

  constructor() {}

  ngOnInit() {
    this.filteredFeedbacks = [...this.feedbacks];
  }

  selectSegment(segment: string) {
    this.segment = segment;
    if (segment == 'all') {
      this.currentFeedbacktitle = 'All feedback';
      this.filteredFeedbacks = [...this.feedbacks];
    } else {
      this.currentFeedbacktitle = 'Feedback needs attention';
      this.filteredFeedbacks = [];
      this.filteredFeedbacks = this.feedbacks.filter((f) => f.needsattention);
    }
  }
}
