import { Component } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { GuidedTourComponent, GuidedTourStep } from './guided-tour.component';

@Component({
  standalone: true,
  imports: [GuidedTourComponent],
  template: `<button id="t" style="position:fixed;top:40px;left:100px;width:60px;height:30px">x</button>
    <app-guided-tour [steps]="steps" />`,
})
class HostComponent {
  steps: GuidedTourStep[] = [
    { id: 'a', titleKey: 'k.a', bodyKey: 'k.b', anchor: () => document.getElementById('t'), placement: 'below' },
    { id: 'b', titleKey: 'k.c', bodyKey: 'k.d', anchor: () => document.getElementById('t'), placement: 'above' },
  ];
}

describe('GuidedTourComponent', () => {
  it('renders the callout for the first step', fakeAsync(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const f = TestBed.createComponent(HostComponent);
    f.detectChanges();
    tick(10);
    f.detectChanges();
    const card = f.nativeElement.querySelector('.onboarding-callout__card') as HTMLElement;
    expect(card).withContext('callout card rendered').toBeTruthy();
    const r = card.getBoundingClientRect();
    expect(r.top).toBe(79); // anchor top 40 + height 30 + 9 arrow gap
  }));

  it('emits finished then closed when walking past the last step, but only closed for the X', fakeAsync(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const f = TestBed.createComponent(GuidedTourComponent);
    f.componentRef.setInput('steps', [
      { id: 'a', titleKey: 'k', bodyKey: 'k', anchor: () => null, placement: 'below' },
    ]);
    const events: string[] = [];
    f.componentInstance.finished.subscribe(() => events.push('finished'));
    f.componentInstance.closed.subscribe(() => events.push('closed'));
    f.detectChanges();
    f.componentInstance.next();
    f.componentInstance.close();
    tick(10);
    expect(events).toEqual(['finished', 'closed', 'closed']);
  }));
});
