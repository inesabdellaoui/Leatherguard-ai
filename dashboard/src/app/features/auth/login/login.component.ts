import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  email = '';
  password = '';
  isLoading = false;
  errorMessage = '';
  greetingMessage = '';
  greetingIcon = '';

  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit() {
    // Si déjà connecté → bypass login direct
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/dashboard']);
      return;
    }
    this.setGreeting();
  }

  setGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) {
      this.greetingMessage = 'Bonjour, prêt pour une nouvelle journée ?';
      this.greetingIcon = '☀️';
    } else if (hour < 18) {
      this.greetingMessage = 'Bon après-midi, restons concentrés !';
      this.greetingIcon = '🌤️';
    } else {
      this.greetingMessage = 'Bonsoir, dernière ligne droite !';
      this.greetingIcon = '🌙';
    }
  }

  login() {
    if (!this.email || !this.password) {
      this.errorMessage = 'Veuillez remplir tous les champs';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.authService.login(this.email, this.password).subscribe({
      next: () => {
        // ✅ AuthService.login() stocke déjà le token via tap()
        // Ne pas re-faire localStorage.setItem ici
        this.router.navigate(['/angular-dashboard']);
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Email ou mot de passe incorrect';
        this.isLoading = false;
      }
    });
  }
}