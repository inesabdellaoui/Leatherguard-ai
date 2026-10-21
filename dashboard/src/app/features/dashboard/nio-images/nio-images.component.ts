import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DashboardService } from '../../../core/services/dashboard.service';

@Component({
  selector: 'app-nio-images',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './nio-images.component.html',
  styleUrls: ['./nio-images.component.css']
})
export class NioImagesComponent implements OnInit {
  isLoading       = true;
  selectedImage: any = null;
  isLoadingDetail = false;

  selectedClient   = '';
  selectedDefect   = '';
  selectedSeverity = '';
  selectedLot      = '';

  images: any[] = [];

  constructor(
    private svc: DashboardService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    // Arrivée depuis traçabilité avec un ID direct
    this.route.queryParams.subscribe(params => {
      if (params['id']) {
        this.loadDetail(params['id']);
      }
    });
    this.loadImages();
  }

  loadImages() {
    this.isLoading = true;
    const params: any = {};
    if (this.selectedClient)   params.client   = this.selectedClient;
    if (this.selectedDefect)   params.defect   = this.selectedDefect;
    if (this.selectedSeverity) params.severity = this.selectedSeverity;
    if (this.selectedLot)      params.lot      = this.selectedLot;

    this.svc.getNioImages(params).subscribe({
      next: (d) => { this.images = d; this.isLoading = false; },
      error: () => { this.isLoading = false; }
    });
  }

  loadDetail(id: string) {
    this.isLoadingDetail = true;
    this.svc.getNioImageDetail(id).subscribe({
      next: (d) => { this.selectedImage = d; this.isLoadingDetail = false; },
      error: () => { this.isLoadingDetail = false; }
    });
  }

  openImage(img: any) { this.loadDetail(img.id_inspection); }
  closeDetail()       { this.selectedImage = null; }

  goToRapport() {
    if (this.selectedImage) {
      this.router.navigate(['/rapport'],
        { queryParams: { piece: this.selectedImage.id_piece } });
    }
  }

  getImageUrl(path: string)  { return this.svc.getImageUrl(path); }

  getSevClass(g: string): string {
    return g === 'elevee' ? 'sev-high' : g === 'moyenne' ? 'sev-med' : 'sev-low';
  }
}