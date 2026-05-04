import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PropertySelectPage } from './property-select.page';

describe('PropertySelectPage', () => {
  let component: PropertySelectPage;
  let fixture: ComponentFixture<PropertySelectPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(PropertySelectPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
