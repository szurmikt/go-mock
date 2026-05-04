import {
  AfterViewInit,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  inject,
  OnInit,
  ViewChild,
} from '@angular/core';
import { NavParams } from '@ionic/angular';
import {
  IonGrid,
  IonRow,
  IonCol,
  IonButton,
  ModalController,
  IonSelect,
  IonSelectOption,
  IonImg,
  IonIcon,
} from '@ionic/angular/standalone';
import { UserService } from 'src/app/services/user.service';
import { Router } from '@angular/router';
import { register } from 'swiper/element/bundle';
import { NgClass } from '@angular/common';
import { Swiper } from 'swiper/types';

register();

@Component({
  selector: 'app-block-date-modal',
  templateUrl: './block-date-modal.component.html',
  styleUrls: ['./block-date-modal.component.scss'],
  imports: [
    IonIcon,
    IonRow,
    IonGrid,
    IonCol,
    IonButton,
    IonSelect,
    IonSelectOption,
    NgClass
],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class BlockDateModalComponent implements OnInit, AfterViewInit {
  navParams = inject(NavParams);
  modalCtrl: ModalController = inject(ModalController);
  userService: UserService = inject(UserService);
  router: Router = inject(Router);

  @ViewChild('roomRef', { read: ElementRef, static: true })
  roomRef!: ElementRef;

  @ViewChild('roomSelectRef', { read: ElementRef, static: true })
  roomSelectRef!: ElementRef;

  @ViewChild('swiper')
  swiperRef: ElementRef | undefined;
  swiper?: Swiper;

  currentRoom: String = '';

  cards: any[] = [];
  selectedCards: any[] = [];

  rooms = [
    'Standard Room',
    'Standard Double Room',
    'Junior Suit',
    'Luxury Suit',
  ];

  constructor() {
    console.log('BlockDateModalComponent const this.rooms', this.rooms);
  }

  ngOnInit() {
    this.generateDayCards();
  }
  ngAfterViewInit() {
    this.swiper = this.swiperRef?.nativeElement.swiper;
    console.log('ngAfterViewInit()', this.swiper);
  }

  roomChange(event: any) {
    console.log('roomChange', event.target.value);
    this.currentRoom = event.target.value;
  }

  left() {
    this.generateDayCards();
  }
  right() {
    this.generateDayCards();
  }

  toggleSelected(card: any) {
    console.log('toggleSelected card', card);

    card.selected = !card.selected;
    console.log('toggleSelected card', card);
    this.selectedCards = [];
    this.selectedCards = this.cards.filter((c) => c.selected);
  }

  toggleRoomSelect() {
    this.roomSelectRef.nativeElement.click();
  }

  generateDayCards() {
    const now = new Date();
    let startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    endDate.setDate(endDate.getDate() + 7);

    let d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    this.cards = [];
    this.cards.push({
      month: d.toLocaleString('default', { month: 'short' }),
      day: d.getDate(),
      selected: false,
      occupied: true,
      date: d,
    });
    for (let i = 1; i < 28; i++) {
      d.setDate(d.getDate() + 1);
      console.log('generateDayCards d', d);

      this.cards.push({
        month: d.toLocaleString('default', { month: 'short' }),
        day: d.getDate(),
        selected: false,
        occupied: Math.random() * 10 > 8,
        date: d,
      });
    }
  }

  swiperSlideChanged(e: any) {
    console.log('changed: ', e);
  }

  swiperReady() {
    this.swiper = this.swiperRef?.nativeElement.swiper;
    console.log('swiperReady()', this.swiper);
  }

  goNext() {
    console.log('goNext()', this.swiper);

    this.swiper?.slideTo(this.swiper.activeIndex + 7);
  }

  goPrev() {
    console.log('goPrev()', this.swiper);
    this.swiper?.slideTo(Math.max(this.swiper.activeIndex - 7, 0));
  }

  block() {
    this.modalCtrl.dismiss();
  }
}
