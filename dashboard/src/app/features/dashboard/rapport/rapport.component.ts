import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { DashboardService } from '../../../core/services/dashboard.service';
import { FormsModule } from '@angular/forms';  // ✅ manquant

@Component({
  selector: 'app-rapport',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rapport.component.html',
  styleUrls: ['./rapport.component.css']
})
export class RapportComponent implements OnInit {
  isLoading = true;
  hasError  = false;
  rapport: any = null;
  isSendingMail = false;
  mailSent      = false;
  recipientEmail = '';

  constructor(
    private svc: DashboardService,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['piece']) {
        this.loadRapport(params['piece']);
      } else {
        this.isLoading = false;
        this.hasError = true;
      }
    });
  }

  loadRapport(pieceId: string) {
  this.isLoading = true;
  this.svc.getPieceRapport(pieceId).subscribe({
    next: (d) => {
      console.log('Rapport reçu :', d);
      console.log('shap_image_path :', d.shap_image_path);
      this.rapport = d;
      this.isLoading = false;
    },
    error: () => { this.hasError = true; this.isLoading = false; }
  });
}

  getImageUrl(path: string) { return this.svc.getImageUrl(path); }

  // ✅ Export PDF via impression navigateur (sans librairie externe)
  exportPDF() {
    window.print();
  }

  // Export JSON (données brutes pour intégration)
  exportJSON() {
    if (!this.rapport) return;
    const blob = new Blob(
      [JSON.stringify(this.rapport, null, 2)],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport_${this.rapport.reference_piece || this.rapport.id_piece}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Envoi mail — appel backend NestJS
  sendMail() {
  if (!this.recipientEmail || !this.rapport) return;
  this.isSendingMail = true;
  this.svc.sendRapportByMail(this.rapport.id_piece, this.recipientEmail).subscribe({
    next: () => {
      this.mailSent    = true;
      this.isSendingMail = false;
    },
    error: (err) => {
      this.isSendingMail = false;
      alert(err.error?.message || 'Email non autorisé — adresse non déclarée dans le système');
    }
  });
}

  getSevClass(g: string): string {
  return g === 'Critique' ? 'sev-high' 
       : g === 'Majeure'  ? 'sev-med' 
       : 'sev-low';
}

  get reportDate(): string {
    return new Date().toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }
}