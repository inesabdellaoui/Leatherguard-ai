import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LotAnalysisComponent } from './lot-analysis.component';

describe('LotAnalysisComponent', () => {
  let component: LotAnalysisComponent;
  let fixture: ComponentFixture<LotAnalysisComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LotAnalysisComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LotAnalysisComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
