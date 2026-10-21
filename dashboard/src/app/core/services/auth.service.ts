import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface LoginResponse {
  access_token: string;
  user: {
    id: string;
    nom: string;
    prenom: string;
    email: string;
    role: string;
    idClient?: string | null;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:3000';

  private tokenKey = 'token';
  private userKey = 'currentUser';

  constructor(
    private http: HttpClient,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, { email, password }).pipe(
      tap((response) => {
        localStorage.setItem(this.tokenKey, response.access_token);
        localStorage.setItem(this.userKey, JSON.stringify(response.user));
      })
    );
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    this.router.navigate(['/login']);
  }

  getCurrentUser(): any {
  if (isPlatformBrowser(this.platformId)) {
    const user = localStorage.getItem('currentUser');
    return user ? JSON.parse(user) : null;
  }
  return null;
}

  getToken(): string | null {
  if (isPlatformBrowser(this.platformId)) {
    return localStorage.getItem('token');
  }
  return null;
}
  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  isAdmin(): boolean {
    return this.getCurrentUser()?.role === 'admin';
  }
}