import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';

import { AuthService } from '../core/auth.service';

const NARROW_QUERY = '(max-width: 959.98px)';

/** Authenticated layout: toolbar with the user menu, side navigation and the routed page. */
@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatDividerModule,
  ],
  template: `
    <mat-toolbar class="toolbar">
      @if (isNarrow()) {
        <button
          mat-icon-button
          type="button"
          aria-label="Toggle navigation"
          (click)="sidenav.toggle()"
        >
          <mat-icon fontSet="material-symbols-outlined">menu</mat-icon>
        </button>
      }
      <a class="brand" routerLink="/">App</a>
      <span class="spacer"></span>
      <button mat-button type="button" class="user-button" [matMenuTriggerFor]="userMenu">
        <mat-icon fontSet="material-symbols-outlined">account_circle</mat-icon>
        <span class="user-name">{{ fullName() }}</span>
      </button>
      <mat-menu #userMenu="matMenu" xPosition="before">
        <div class="menu-header" mat-menu-item disabled>{{ fullName() }}</div>
        <mat-divider />
        <a mat-menu-item routerLink="/account/password">
          <mat-icon fontSet="material-symbols-outlined">key</mat-icon>
          <span>Change password</span>
        </a>
        <button mat-menu-item type="button" (click)="logout()">
          <mat-icon fontSet="material-symbols-outlined">logout</mat-icon>
          <span>Sign out</span>
        </button>
      </mat-menu>
    </mat-toolbar>

    <mat-sidenav-container class="container">
      <mat-sidenav
        #sidenav
        class="sidenav"
        [mode]="isNarrow() ? 'over' : 'side'"
        [opened]="!isNarrow()"
        [fixedInViewport]="isNarrow()"
        fixedTopGap="64"
      >
        <mat-nav-list>
          <a
            mat-list-item
            routerLink="/"
            routerLinkActive
            #homeLink="routerLinkActive"
            [routerLinkActiveOptions]="{ exact: true }"
            [activated]="homeLink.isActive"
            (click)="closeIfNarrow(sidenav)"
          >
            <mat-icon matListItemIcon fontSet="material-symbols-outlined">home</mat-icon>
            <span matListItemTitle>Home</span>
          </a>
          @if (canListUsers()) {
            <a
              mat-list-item
              routerLink="/users"
              routerLinkActive
              #usersLink="routerLinkActive"
              [activated]="usersLink.isActive"
              (click)="closeIfNarrow(sidenav)"
            >
              <mat-icon matListItemIcon fontSet="material-symbols-outlined">group</mat-icon>
              <span matListItemTitle>Users</span>
            </a>
          }
          @if (canListCompanies()) {
            <a
              mat-list-item
              routerLink="/companies"
              routerLinkActive
              #companiesLink="routerLinkActive"
              [activated]="companiesLink.isActive"
              (click)="closeIfNarrow(sidenav)"
            >
              <mat-icon matListItemIcon fontSet="material-symbols-outlined">business</mat-icon>
              <span matListItemTitle>Companies</span>
            </a>
          }
        </mat-nav-list>
      </mat-sidenav>

      <mat-sidenav-content class="content">
        <main>
          <router-outlet />
        </main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .toolbar {
      position: relative;
      z-index: 2;
      gap: 8px;
      background: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary);
    }
    .toolbar .mat-mdc-icon-button,
    .toolbar .user-button {
      color: inherit;
    }
    .brand {
      color: inherit;
      text-decoration: none;
      font: var(--mat-sys-title-large);
    }
    .spacer {
      flex: 1;
    }
    .user-name {
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .menu-header {
      font: var(--mat-sys-title-small);
    }
    .container {
      flex: 1;
    }
    .sidenav {
      width: 240px;
    }
    main {
      padding: 24px;
      max-width: 1200px;
      margin: 0 auto;
    }
    @media (max-width: 599.98px) {
      .user-name {
        display: none;
      }
      main {
        padding: 16px;
      }
    }
  `,
})
export class ShellComponent {
  private readonly auth = inject(AuthService);

  protected readonly isNarrow = toSignal(
    inject(BreakpointObserver)
      .observe(NARROW_QUERY)
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );

  protected readonly fullName = computed(() => this.auth.currentUser()?.full_name ?? '');
  protected readonly canListUsers = computed(() => this.auth.hasScope('users:list'));
  protected readonly canListCompanies = computed(() => this.auth.hasScope('companies:list'));

  protected closeIfNarrow(sidenav: MatSidenav): void {
    if (this.isNarrow()) void sidenav.close();
  }

  protected logout(): void {
    this.auth.logout();
  }
}
