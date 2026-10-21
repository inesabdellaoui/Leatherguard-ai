import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DefectsDashboardComponent } from './defects-dashboard.component';

describe('DefectsDashboardComponent', () => {
  let component: DefectsDashboardComponent;
  let fixture: ComponentFixture<DefectsDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DefectsDashboardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DefectsDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
