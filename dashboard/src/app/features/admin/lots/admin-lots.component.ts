import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-admin-lots',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-lots.component.html',
  styleUrls: ['./admin-lots.component.css']
})
export class AdminLotsComponent implements OnInit {
  isLoading = false;
  isSaving = false;
  hasError = false;
  searchTerm = '';
  filterClient = '';
  filterStatut = '';
  showFormModal = false;
  showDeleteModal = false;
  isEditing = false;
  lotToDelete: any = null;
  form: any = { reference: '', client: '', date_creation: '', statut: 'EN_COURS' };
  formErrors: any = {};
  lots: any[] = [];
  filteredLots: any[] = [];

  private apiUrl = 'http://localhost:3000';

  constructor(private http: HttpClient, private authService: AuthService) {}

  private getHeaders() {
    const token = this.authService.getToken();
    return { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) };
  }

  get lotsTermines() { return this.lots.filter(l => l.statut === 'TERMINE').length; }
  get lotsEnCours() { return this.lots.filter(l => l.statut === 'EN_COURS').length; }

  ngOnInit() { this.loadLots(); }

  loadLots() {
    this.isLoading = true;
    this.http.get<any[]>(`${this.apiUrl}/dashboard/lots-list`, this.getHeaders())
      .subscribe({
        next: (data) => {
          this.lots = data;
          this.applyFilters();
          this.isLoading = false;
        },
        error: () => {
          this.hasError = true;
          this.isLoading = false;
        }
      });
  }

  applyFilters() {
    this.filteredLots = this.lots.filter(l => {
      const matchSearch = !this.searchTerm ||
        l.reference?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        l.id_lot?.toLowerCase().includes(this.searchTerm.toLowerCase());
      const matchClient = !this.filterClient || l.nom_client === this.filterClient;
      const matchStatut = !this.filterStatut || l.statut_lot === this.filterStatut;
      return matchSearch && matchClient && matchStatut;
    });
  }

  resetFilters() {
    this.searchTerm = ''; this.filterClient = ''; this.filterStatut = '';
    this.applyFilters();
  }

  openCreate() {
    this.isEditing = false;
    this.form = { reference: '', client: '', date_creation: '', statut: 'EN_COURS' };
    this.formErrors = {};
    this.showFormModal = true;
  }

  openEdit(lot: any) {
    this.isEditing = true;
    this.form = {
      id: lot.id_lot,
      reference: lot.id_lot,
      client: lot.nom_client,
      date_creation: lot.date_reception?.split('T')[0],
      statut: lot.statut_lot
    };
    this.formErrors = {};
    this.showFormModal = true;
  }

  confirmDelete(lot: any) {
    this.lotToDelete = lot;
    this.showDeleteModal = true;
  }

  closeModal() {
    this.showFormModal = false;
    this.showDeleteModal = false;
    this.lotToDelete = null;
  }

  validate(): boolean {
    this.formErrors = {};
    if (!this.form.reference) this.formErrors.reference = 'La référence est obligatoire';
    if (!this.form.client) this.formErrors.client = 'Le client est obligatoire';
    if (!this.form.date_creation) this.formErrors.date_creation = 'La date est obligatoire';
    return Object.keys(this.formErrors).length === 0;
  }

  saveLot() {
    if (!this.validate()) return;
    this.isSaving = true;
    const body = {
      id_lot: this.form.reference,
      id_client: this.form.client === 'BMW' ? 'C001' : 'C002',
      date_reception: this.form.date_creation,
      statut_lot: this.form.statut
    };
    const req = this.isEditing
      ? this.http.put(`${this.apiUrl}/dashboard/lots/${this.form.id}`, body, this.getHeaders())
      : this.http.post(`${this.apiUrl}/dashboard/lots`, body, this.getHeaders());

    req.subscribe({
      next: () => { this.isSaving = false; this.closeModal(); this.loadLots(); },
      error: () => { this.isSaving = false; }
    });
  }

  deleteLot() {
    if (!this.lotToDelete) return;
    this.isSaving = true;
    this.http.delete(`${this.apiUrl}/dashboard/lots/${this.lotToDelete.id_lot}`, this.getHeaders())
      .subscribe({
        next: () => { this.isSaving = false; this.closeModal(); this.loadLots(); },
        error: () => { this.isSaving = false; }
      });
  }
}