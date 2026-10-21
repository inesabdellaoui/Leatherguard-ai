// src/app/features/dashboard/dashboard.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent {
  safeUrl: SafeResourceUrl;

  constructor(private sanitizer: DomSanitizer) {
    // ✅ L'URL embed réelle que vous avez dans votre HTML
    const url = 'https://app.powerbi.com/view?r=eyJrIjoiOWVhZTNiYjMtYjVjOS00YWVjLTgxZDgtNjM1MDBiNGI5MDE0IiwidCI6ImRiZDY2NjRkLTRlYjktNDZlYi05OWQ4LTVjNDNiYTE1M2M2MSIsImMiOjl9';
    this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }
}