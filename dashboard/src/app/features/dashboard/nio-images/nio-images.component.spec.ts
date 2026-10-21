import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NioImagesComponent } from './nio-images.component';

describe('NioImagesComponent', () => {
  let component: NioImagesComponent;
  let fixture: ComponentFixture<NioImagesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NioImagesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NioImagesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
