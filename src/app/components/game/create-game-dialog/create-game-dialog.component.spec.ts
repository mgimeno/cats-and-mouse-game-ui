import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { CreateGameDialogComponent } from './create-game-dialog.component';

describe('CreateGameDialogComponent', () => {
  let component: CreateGameDialogComponent;
  let fixture: ComponentFixture<CreateGameDialogComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ CreateGameDialogComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CreateGameDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});