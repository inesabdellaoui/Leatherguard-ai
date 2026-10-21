import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { AngularDashboardComponent } from './features/dashboard/angular-dashboard/angular-dashboard.component';
import { DefectsDashboardComponent } from './features/dashboard/defects-dashboard/defects-dashboard.component';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { PerformanceDashboardComponent } from './features/dashboard/performance-dashboard/performance-dashboard.component';
import { LotAnalysisComponent } from './features/dashboard/lot-analysis/lot-analysis.component';
import { TraceabilityComponent }  from './features/dashboard/traceability/traceability.component';
import { NioImagesComponent }     from './features/dashboard/nio-images/nio-images.component';
import { RapportComponent }       from './features/dashboard/rapport/rapport.component';
import { AdminLotsComponent } from './features/admin/lots/admin-lots.component';
import { UsersListComponent } from './features/admin/users/users-list.component';


export const routes: Routes = [
  // Racine → login si non connecté
  { path: '', redirectTo: '/login', pathMatch: 'full' },

  // Auth (publique)
  { path: 'login', component: LoginComponent },

  // Dashboard Power BI (protégé)
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [authGuard]
  },

  // Dashboard Angular natif (protégé)
  {
    path: 'angular-dashboard',
    component: AngularDashboardComponent,
    canActivate: [authGuard]
  },

  // Dashboard défauts (protégé)
  {
    path: 'dashboard/defects',
    component: DefectsDashboardComponent,
    canActivate: [authGuard]
  },
  { path: 'performance', component: PerformanceDashboardComponent, canActivate: [authGuard] },
{ path: 'lot-analysis', component: LotAnalysisComponent,         canActivate: [authGuard] },
{ path: 'traceability', component: TraceabilityComponent, canActivate: [authGuard] },
{ path: 'nio-images',   component: NioImagesComponent,    canActivate: [authGuard] },
{ path: 'rapport',      component: RapportComponent,      canActivate: [authGuard] },
{ path: 'admin/lots', component: AdminLotsComponent, canActivate: [authGuard] },
{ path: 'admin/users', component: UsersListComponent, canActivate: [authGuard, adminGuard] },

// Inspections (protégé) — à créer
  // {
  //   path: 'inspections',
  //   component: InspectionsComponent,
  //   canActivate: [authGuard]
  // },

  // Admin — utilisateurs (admin seulement)
  // {
  //   path: 'admin/users',
  //   component: UsersListComponent,
  //   canActivate: [authGuard, adminGuard]
  // },

  // ⚠️ TOUJOURS EN DERNIER — catch-all
  { path: '**', redirectTo: '/login' }
];