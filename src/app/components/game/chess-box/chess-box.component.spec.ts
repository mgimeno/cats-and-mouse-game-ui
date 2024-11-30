import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { ChessBoxComponent } from './chess-box.component';

describe('ChessBoxComponent', () => {
  let component: ChessBoxComponent;
  let fixture: ComponentFixture<ChessBoxComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ChessBoxComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ChessBoxComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
