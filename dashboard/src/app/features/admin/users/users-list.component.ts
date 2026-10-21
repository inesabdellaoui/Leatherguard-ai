import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-users-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users-list.component.html',
  styleUrls: ['./users-list.component.css']
})
export class UsersListComponent implements OnInit {
  isLoading    = false;
  isSaving     = false;
  searchTerm   = '';
  filterRole   = '';
  showFormModal   = false;
  showDeleteModal = false;
  isEditing    = false;
  userToDelete: any = null;
  form: any    = { prenom: '', nom: '', email: '', role: '', password: '', isActive: true };
  formErrors: any  = {};
  users: any[]        = [];
  filteredUsers: any[] = [];

  private apiUrl = 'http://localhost:3000';

  constructor(private http: HttpClient, private authService: AuthService) {}

  private getHeaders() {
    const token = this.authService.getToken();
    return { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) };
  }

  get totalUsers()  { return this.users.length; }
  get activeUsers() { return this.users.filter(u => u.isActive === true).length; }
  get adminUsers()  { return this.users.filter(u => u.role === 'admin').length; }

  ngOnInit() { this.loadUsers(); }

  loadUsers() {
    this.isLoading = true;
    this.http.get<any[]>(`${this.apiUrl}/users`, this.getHeaders()).subscribe({
      next: (data) => {
        this.users = data;
        this.applyFilters();
        this.isLoading = false;
      },
      error: (err) => {
        console.log('Erreur users :', err);
        this.isLoading = false;
      }
    });
  }

  applyFilters() {
    this.filteredUsers = this.users.filter(u => {
      const matchSearch = !this.searchTerm ||
        `${u.prenom} ${u.nom} ${u.email}`.toLowerCase()
          .includes(this.searchTerm.toLowerCase());
      const matchRole = !this.filterRole || u.role === this.filterRole;
      return matchSearch && matchRole;
    });
  }

  resetFilters() {
    this.searchTerm = '';
    this.filterRole = '';
    this.applyFilters();
  }

  openCreate() {
    this.isEditing = false;
    this.form = { prenom: '', nom: '', email: '', role: '', password: '', isActive: true };
    this.formErrors = {};
    this.showFormModal = true;
  }

  openEdit(user: any) {
    this.isEditing = true;
    this.form = { ...user, password: '' };
    this.formErrors = {};
    this.showFormModal = true;
  }

  confirmDelete(user: any) {
    this.userToDelete  = user;
    this.showDeleteModal = true;
  }

  closeModal() {
    this.showFormModal   = false;
    this.showDeleteModal = false;
    this.userToDelete    = null;
  }

  validate(): boolean {
    this.formErrors = {};
    if (!this.form.prenom)   this.formErrors.prenom   = 'Le prénom est obligatoire';
    if (!this.form.nom)      this.formErrors.nom      = 'Le nom est obligatoire';
    if (!this.form.email)    this.formErrors.email    = 'L\'email est obligatoire';
    if (!this.form.role)     this.formErrors.role     = 'Le rôle est obligatoire';
    if (!this.isEditing && !this.form.password)
      this.formErrors.password = 'Le mot de passe est obligatoire';
    return Object.keys(this.formErrors).length === 0;
  }

  saveUser() {
    if (!this.validate()) return;
    this.isSaving = true;
    const req = this.isEditing
      ? this.http.put(`${this.apiUrl}/users/${this.form.id}`, this.form, this.getHeaders())
      : this.http.post(`${this.apiUrl}/users`, this.form, this.getHeaders());
    req.subscribe({
      next: () => { this.isSaving = false; this.closeModal(); this.loadUsers(); },
      error: () => { this.isSaving = false; }
    });
  }

  deleteUser() {
    if (!this.userToDelete) return;
    this.isSaving = true;
    this.http.delete(`${this.apiUrl}/users/${this.userToDelete.id}`, this.getHeaders())
      .subscribe({
        next: () => { this.isSaving = false; this.closeModal(); this.loadUsers(); },
        error: () => { this.isSaving = false; }
      });
  }

  getRoleLabel(role: string): string {
    const map: Record<string, string> = {
      'admin'               : 'Administrateur',
      'responsable_qualite' : 'Resp. Qualité',
      'operatrice_bmw'      : 'Opératrice BMW',
      'operatrice_rr'       : 'Opératrice LR'
    };
    return map[role] ?? role;
  }

  getRoleClass(role: string): string {
    const map: Record<string, string> = {
      'admin'               : 'badge-admin',
      'responsable_qualite' : 'badge-rq',
      'operatrice_bmw'      : 'badge-cip',
      'operatrice_rr'       : 'badge-cip'
    };
    return map[role] ?? '';
  }

  getInitials(prenom: string, nom: string): string {
    return `${prenom?.[0] ?? ''}${nom?.[0] ?? ''}`.toUpperCase();
  }
}