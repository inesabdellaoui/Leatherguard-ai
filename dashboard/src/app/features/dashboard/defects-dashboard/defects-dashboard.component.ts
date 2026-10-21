import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService } from '../../../core/services/dashboard.service';

@Component({
  selector: 'app-defects-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './defects-dashboard.component.html',
  styleUrls: ['./defects-dashboard.component.css']
})
export class DefectsDashboardComponent implements OnInit {
  isLoading = true;
  hasError = false;

  // Filtres
  selectedClient = '';
  selectedDefect = '';
  selectedSeverity = '';
  startDate = '';
  endDate = '';

  // KPIs
  totalDefects = 0;
  dominantDefect = '—';
  dominantSeverity = '—';
  impactedLots = 0;

  // Data
  defectsDistribution: any[] = [];
  defectsBySeverity: any[] = [];
  defectsTrend: any[] = [];
  topDefectsLots: any[] = [];

  constructor(private dashboardService: DashboardService) {}

  ngOnInit() { this.loadAll(); }

  loadAll() {
    this.isLoading = true;
    this.hasError = false;
    this.loadKpis();
    this.loadDefectsDistribution();
    this.loadSeverity();
    this.loadTrend();
    this.loadTopLots();
  }

  getFilters() {
    return {
      client: this.selectedClient,
      defect: this.selectedDefect,
      severity: this.selectedSeverity,
      startDate: this.startDate,
      endDate: this.endDate
    };
  }

  applyFilters() { this.loadAll(); }

  resetFilters() {
    this.selectedClient = '';
    this.selectedDefect = '';
    this.selectedSeverity = '';
    this.startDate = '';
    this.endDate = '';
    this.loadAll();
  }

  loadKpis() {
    this.dashboardService.getDefectsKpis(this.getFilters()).subscribe({
      next: (data: any) => {
        this.totalDefects    = data.total_defects;
        this.dominantDefect  = data.dominant_defect;
        this.dominantSeverity = data.dominant_severity;
        this.impactedLots    = data.impacted_lots;
        this.isLoading = false;
      },
      error: () => { this.hasError = true; this.isLoading = false; }
    });
  }

  loadDefectsDistribution() {
    this.dashboardService.getDefectsDistribution().subscribe({
      next: (d) => { this.defectsDistribution = d; },
      error: () => {}
    });
  }

  loadSeverity() {
    this.dashboardService.getDefectsBySeverity().subscribe({
      next: (d) => { this.defectsBySeverity = d; },
      error: () => {}
    });
  }

  loadTrend() {
    this.dashboardService.getDefectsTrend().subscribe({
      next: (d) => { this.defectsTrend = d; },
      error: () => {}
    });
  }

  loadTopLots() {
    this.dashboardService.getTopDefectsLots().subscribe({
      next: (d) => { this.topDefectsLots = d; },
      error: () => {}
    });
  }

  getBarHeight(val: number, data: any[], key: string): number {
    const max = Math.max(...data.map(d => d[key] ?? 0));
    return max > 0 ? (val / max) * 100 : 0;
  }

  getSeverityColor(gravite: string): string {
    const map: Record<string, string> = {
      elevee: '#dc2626', moyenne: '#d97706', faible: '#16a34a'
    };
    return map[gravite?.toLowerCase()] ?? '#94a3b8';
  }
}