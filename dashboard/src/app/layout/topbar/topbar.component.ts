import { Component, OnInit, OnDestroy, HostListener, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Subscription, interval } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './topbar.component.html',
  styleUrls: ['./topbar.component.css']
})
export class TopbarComponent implements OnInit, OnDestroy {
  pageTitle = "Vue d'ensemble";
  currentDateTime = new Date();
  notificationCount = 3;
  showNotifications = false;
  showUserMenu = false;
  currentUser: any = null;
  private subs = new Subscription();

  notifications = [
    { message: 'Nouvelle inspection effectuée', type: 'info',    time: 'Il y a 5 min' },
    { message: 'Taux de défauts en hausse',     type: 'warning', time: 'Il y a 1h' },
    { message: 'Lot BMW-001 terminé',           type: 'success', time: 'Il y a 2h' },
  ];

  constructor(
    private router: Router,
    private authService: AuthService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    this.currentUser = this.authService.getCurrentUser();

    this.subs.add(
      this.router.events.pipe(
        filter(e => e instanceof NavigationEnd)
      ).subscribe((e: any) => this.updatePageTitle(e.url))
    );

    if (isPlatformBrowser(this.platformId)) {
      this.subs.add(
        interval(60000).subscribe(() => {
          this.currentDateTime = new Date();
        })
      );
    }

    this.updatePageTitle(this.router.url);
  }

  ngOnDestroy() {
    this.subs.unsubscribe();
  }

  updatePageTitle(url: string) {
  const map: [string, string][] = [
    ['/dashboard/defects',  'Analyse des défauts'],
    ['/dashboard',          'Tableau de bord Power BI'],
    ['/angular-dashboard',  "Vue d'ensemble"],
    ['/performance',        'Performances'],
    ['/lot-analysis',       'Analyse par lot'],
    ['/traceability',       'Traçabilité'],
    ['/nio-images',         'Images NIO'],
    ['/rapport',            'Rapports'],
    ['/admin/lots',         'Gestion des lots'],
    ['/admin/users',        'Gestion des utilisateurs'],
  ];
  const match = map.find(([key]) => url.startsWith(key));
  this.pageTitle = match ? match[1] : 'CuirQuality';
}

  toggleMobileMenu() {
    window.dispatchEvent(new CustomEvent('toggleMobileSidebar'));
  }

  toggleNotifications() {
    this.showNotifications = !this.showNotifications;
    this.showUserMenu = false;
  }

  toggleUserMenu() {
    this.showUserMenu = !this.showUserMenu;
    this.showNotifications = false;
  }

  markAllRead() {
    this.notificationCount = 0;
    this.notifications = [];
    this.showNotifications = false;
  }

  logout() {
    this.authService.logout();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const t = event.target as HTMLElement;
    if (!t.closest('.notifications-wrapper') && !t.closest('.user-menu-wrapper')) {
      this.showNotifications = false;
      this.showUserMenu = false;
    }
  }

  get userInitials(): string {
    const u = this.currentUser;
    if (!u) return '?';
    return `${u.prenom?.[0] ?? ''}${u.nom?.[0] ?? ''}`.toUpperCase();
  }

  get userRoleLabel(): string {
    const roles: Record<string, string> = {
      admin: 'Administrateur',
      responsable_qualite: 'Resp. Qualité',
      operatrice_bmw: 'Opératrice BMW',
      operatrice_rr: 'Opératrice RR',
    };
    return roles[this.currentUser?.role] ?? this.currentUser?.role ?? 'Utilisateur';
  }
}