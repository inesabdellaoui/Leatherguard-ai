import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DashboardService } from '../../../core/services/dashboard.service';

@Component({
  selector: 'app-traceability',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './traceability.component.html',
  styleUrls: ['./traceability.component.css']
})
export class TraceabilityComponent implements OnInit {
  isLoading    = false;
  hasSearched  = false;
  searchQuery  = '';
  selectedClient = '';
  selectedLot    = '';
  selectedResult = '';
  startDate      = '';
  endDate        = '';

  results: any[] = [];

  constructor(
    private svc: DashboardService,
    private router: Router
  ) {}

  ngOnInit() { this.search(); }

  search() {
    this.isLoading = true;
    this.hasSearched = true;
    const params: any = {};
    if (this.searchQuery)    params.q         = this.searchQuery;
    if (this.selectedClient) params.client    = this.selectedClient;
    if (this.selectedLot)    params.lot       = this.selectedLot;
    if (this.selectedResult) params.result    = this.selectedResult;
    if (this.startDate)      params.startDate = this.startDate;
    if (this.endDate)        params.endDate   = this.endDate;

    this.svc.searchPieces(params).subscribe({
      next: (d) => { this.results = d; this.isLoading = false; },
      error: () => { this.isLoading = false; }
    });
  }

  reset() {
    this.searchQuery = '';
    this.selectedClient = '';
    this.selectedLot = '';
    this.selectedResult = '';
    this.startDate = '';
    this.endDate = '';
    this.search();
  }

  goToNioImage(inspectionId: string) {
    this.router.navigate(['/nio-images'], { queryParams: { id: inspectionId } });
  }

  goToRapport(pieceId: string) {
    this.router.navigate(['/rapport'], { queryParams: { piece: pieceId } });
  }

  getImageUrl(path: string) { return this.svc.getImageUrl(path); }
}