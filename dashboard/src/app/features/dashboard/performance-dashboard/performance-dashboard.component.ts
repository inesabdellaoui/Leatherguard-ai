import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService } from '../../../core/services/dashboard.service';

@Component({
  selector: 'app-performance-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './performance-dashboard.component.html',
  styleUrls: ['./performance-dashboard.component.css']
})
export class PerformanceDashboardComponent implements OnInit {
  isLoading = true;
  hasError  = false;

  // KPIs
  totalInspections = 0;
  cadenceParHeure  = 0;
  tauxConformite   = 0;
  delaiMoyenHeures = 0;

  // Data
  perfTrend:        any[] = [];
  perfByClient:     any[] = [];
  perfByOperatrice: any[] = [];

  constructor(private svc: DashboardService) {}

  ngOnInit() { this.loadAll(); }

  loadAll() {
    this.isLoading = true;
    this.hasError  = false;
    this.loadKpis();
    this.loadTrend();
    this.loadByClient();
    this.loadByOperatrice();
  }

  loadKpis() {
    this.svc.getPerfKpis().subscribe({
      next: (d) => {
        this.totalInspections = +d.total_inspections  || 0;
        this.cadenceParHeure  = +d.cadence_par_heure  || 0;
        this.tauxConformite   = +d.taux_conformite    || 0;
        this.delaiMoyenHeures = +d.delai_moyen_heures || 0;
        this.isLoading = false;
      },
      error: () => { this.hasError = true; this.isLoading = false; }
    });
  }

  loadTrend() {
    this.svc.getPerfTrend().subscribe({
      next: (d) => { this.perfTrend = d.reverse(); },
      error: () => {}
    });
  }

  loadByClient() {
    this.svc.getPerfByClient().subscribe({
      next: (d) => { this.perfByClient = d; },
      error: () => {}
    });
  }

  loadByOperatrice() {
    this.svc.getPerfByOperatrice().subscribe({
      next: (d) => { this.perfByOperatrice = d; },
      error: () => {}
    });
  }

  getBarH(val: number, arr: any[], key: string): number {
    const max = Math.max(...arr.map(d => +d[key] || 0));
    return max > 0 ? (+val / max) * 100 : 0;
  }

  getTrendColor(nio: number, total: number): string {
    const mdr = total > 0 ? (nio / total) * 100 : 0;
    if (mdr > 15) return '#dc2626';
    if (mdr > 10) return '#d97706';
    return '#1a7cc4';
  }
}