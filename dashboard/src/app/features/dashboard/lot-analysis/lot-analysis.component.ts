import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService } from '../../../core/services/dashboard.service';

@Component({
  selector: 'app-lot-analysis',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lot-analysis.component.html',
  styleUrls: ['./lot-analysis.component.css']
})
export class LotAnalysisComponent implements OnInit {
  isLoading    = true;
  hasError     = false;
  selectedLot: any = null;
  isLoadingDetail = false;

  // Filtres
  selectedClient = '';
  selectedStatut = '';
  startDate      = '';
  endDate        = '';

  // KPIs globaux
  totalLots     = 0;
  lotsCritiques = 0;
  mdrMoyen      = 0;

  // Data
  lotsList:          any[] = [];
  lotsTopProblematic: any[] = [];

  constructor(private svc: DashboardService) {}

  ngOnInit() { this.loadAll(); }

  loadAll() {
    this.isLoading = true;
    this.hasError  = false;
    this.loadKpis();
    this.loadList();
    this.loadTopProblematic();
  }

  loadKpis() {
    this.svc.getLotsKpis().subscribe({
      next: (d) => {
        this.totalLots     = +d.total_lots     || 0;
        this.lotsCritiques = +d.lots_critiques || 0;
        this.mdrMoyen      = +d.mdr_moyen      || 0;
        this.isLoading = false;
      },
      error: () => { this.hasError = true; this.isLoading = false; }
    });
  }

  loadList() {
    const params: any = {};
    if (this.selectedClient) params.client = this.selectedClient;
    if (this.selectedStatut) params.statut = this.selectedStatut;
    if (this.startDate)      params.startDate = this.startDate;
    if (this.endDate)        params.endDate   = this.endDate;

    this.svc.getLotsList(params).subscribe({
      next: (d) => { this.lotsList = d; },
      error: () => {}
    });
  }

  loadTopProblematic() {
    this.svc.getLotsTopProblematic().subscribe({
      next: (d) => { this.lotsTopProblematic = d; },
      error: () => {}
    });
  }

  applyFilters()  { this.loadList(); }

  resetFilters() {
    this.selectedClient = '';
    this.selectedStatut = '';
    this.startDate      = '';
    this.endDate        = '';
    this.loadAll();
  }

  openDetail(idLot: string) {
    this.isLoadingDetail = true;
    this.svc.getLotDetail(idLot).subscribe({
      next: (d) => { this.selectedLot = d; this.isLoadingDetail = false; },
      error: () => { this.isLoadingDetail = false; }
    });
  }

  closeDetail() { this.selectedLot = null; }

  getStatusClass(statut: string): string {
    const map: Record<string, string> = {
      termine: 'status-ok', en_cours: 'status-progress',
      en_attente: 'status-wait', rejete: 'status-reject'
    };
    return map[statut?.toLowerCase()] ?? 'status-wait';
  }

  getMdrClass(mdr: number): string {
    if (mdr > 15) return 'mdr-high';
    if (mdr > 10) return 'mdr-med';
    return 'mdr-ok';
  }

  getBarH(val: number, arr: any[], key: string): number {
    const max = Math.max(...arr.map(d => +d[key] || 0));
    return max > 0 ? (+val / max) * 100 : 0;
  }
}