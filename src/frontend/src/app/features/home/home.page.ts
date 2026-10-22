import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { Module, MODULES } from '@contracts/api.models';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth.service';

interface Shortcut {
  title: string;
  description: string;
  icon: string;
  link: string;
}

const MODULE_SHORTCUTS: Record<Module, Shortcut> = {
  users: {
    title: 'Users',
    description: 'Manage user accounts and permissions.',
    icon: 'group',
    link: '/users',
  },
  companies: {
    title: 'Companies',
    description: 'Browse and manage companies.',
    icon: 'business',
    link: '/companies',
  },
};

const PASSWORD_SHORTCUT: Shortcut = {
  title: 'Change password',
  description: 'Update the password you use to sign in.',
  icon: 'key',
  link: '/account/password',
};

@Component({
  selector: 'app-home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatCardModule, MatIconModule],
  template: `
    <h1>Welcome, {{ fullName() }}</h1>

    @if (moduleShortcuts().length === 0) {
      <p class="empty">
        You don't have access to any modules yet. Contact an administrator if you need access.
      </p>
    }

    <div class="grid">
      @for (shortcut of shortcuts(); track shortcut.link) {
        <a class="shortcut" [routerLink]="shortcut.link">
          <mat-card appearance="outlined">
            <mat-card-header>
              <mat-icon mat-card-avatar fontSet="material-symbols-outlined">{{
                shortcut.icon
              }}</mat-icon>
              <mat-card-title>{{ shortcut.title }}</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <p>{{ shortcut.description }}</p>
            </mat-card-content>
          </mat-card>
        </a>
      }
    </div>
  `,
  styles: `
    h1 {
      font: var(--mat-sys-headline-small);
      margin: 0 0 16px;
    }
    .empty {
      color: var(--mat-sys-on-surface-variant);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 16px;
    }
    .shortcut {
      color: inherit;
      text-decoration: none;
    }
    .shortcut mat-card {
      height: 100%;
      transition: background-color 150ms;
    }
    .shortcut:hover mat-card,
    .shortcut:focus-visible mat-card {
      background-color: var(--mat-sys-surface-container);
    }
    mat-icon[mat-card-avatar] {
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--mat-sys-primary);
    }
    mat-card-content p {
      margin: 8px 0 0;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class HomePage {
  private readonly auth = inject(AuthService);

  protected readonly fullName = computed(() => this.auth.currentUser()?.full_name ?? '');
  protected readonly moduleShortcuts = computed(() =>
    MODULES.filter((module) => this.auth.hasScope(`${module}:list`)).map(
      (module) => MODULE_SHORTCUTS[module],
    ),
  );
  protected readonly shortcuts = computed(() => [...this.moduleShortcuts(), PASSWORD_SHORTCUT]);
}
