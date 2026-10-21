import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService } from '../../../core/services/dashboard.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-angular-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './angular-dashboard.component.html',
  styleUrls: ['./angular-dashboard.component.css']
})
export class AngularDashboardComponent implements OnInit, OnDestroy {
  currentUser: any;
  isLoading = true;
  hasError = false;

  // KPIs
  totalInspections = 0;
  piecesOK = 0;
  piecesNIO = 0;
  mdr = 0;

  // Filtres
  selectedClient = '';
  startDate = '';
  endDate = '';
  selectedDefect = '';

  // Data
  chartData: any[] = [];
  defectsDistribution: any[] = [];
  topLots: any[] = [];

  private timeInterval: any;
  currentTime = '';

  constructor(
    private dashboardService: DashboardService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.currentUser = this.authService.getCurrentUser();
    this.updateTime();
    this.timeInterval = setInterval(() => this.updateTime(), 1000);
    this.loadAll();
  }

  ngOnDestroy() {
    if (this.timeInterval) clearInterval(this.timeInterval);
  }

  updateTime() {
    this.currentTime = new Date().toLocaleTimeString('fr-FR');
  }

  loadAll() {
    this.isLoading = true;
    this.hasError = false;
    this.loadKpis();
    this.loadTrend();
    this.loadTopLots();
    this.loadDefects();
  }

  loadKpis() {
    this.dashboardService.getKpis().subscribe({
      next: (data) => {
        this.totalInspections = data.totalInspections;
        this.piecesOK = data.piecesOK;
        this.piecesNIO = data.piecesNIO;
        this.mdr = data.mdr;
        this.isLoading = false;
      },
      error: () => {
        this.hasError = true;
        this.isLoading = false;
      }
    });
  }

  loadTrend() {
    this.dashboardService.getInspectionsTrend().subscribe({
      next: (data) => { this.chartData = data; },
      error: () => {}
    });
  }

  loadTopLots() {
    this.dashboardService.getTopLots().subscribe({
      next: (data) => {
        this.topLots = data.map(item => ({
          ...item,
          mdr: Number(item.mdr)
        }));
      },
      error: () => {}
    });
  }

  loadDefects() {
    this.dashboardService.getDefectsDistribution().subscribe({
      next: (data) => { this.defectsDistribution = data; },
      error: () => {}
    });
  }

  applyFilters() {
    const params = {
      client: this.selectedClient,
      startDate: this.startDate,
      endDate: this.endDate,
      defect: this.selectedDefect
    };
    this.dashboardService.getKpisFiltered(params).subscribe({
      next: (data: any) => {
        this.totalInspections = data.total;
        this.piecesOK = data.ok;
        this.piecesNIO = data.nio;
      },
      error: () => {}
    });
  }

  resetFilters() {
    this.selectedClient = '';
    this.startDate = '';
    this.endDate = '';
    this.selectedDefect = '';
    this.loadAll();
  }

  // ✅ Calcul dynamique de hauteur de barre — plus de hardcode
  getBarHeight(value: number, data: any[], key: string): number {
    const max = Math.max(...data.map(d => d[key] ?? 0));
    return max > 0 ? (value / max) * 100 : 0;
  }

  get conformityRate(): number {
    if (!this.totalInspections) return 0;
    return Math.round((this.piecesOK / this.totalInspections) * 100 * 10) / 10;
  }
}