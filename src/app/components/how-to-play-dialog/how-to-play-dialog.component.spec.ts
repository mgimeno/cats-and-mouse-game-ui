import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { HowToPlayDialogComponent } from './how-to-play-dialog.component';

describe('HowToPlayDialogComponent', () => {
  let component: HowToPlayDialogComponent;
  let fixture: ComponentFixture<HowToPlayDialogComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ HowToPlayDialogComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(HowToPlayDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});