import { Routes } from '@angular/router';

import { authGuard, guestGuard, scopeGuard } from './core/guards';

// Route params (`:id`) and query params are bound to component inputs
// (withComponentInputBinding). `:id` is absent on the "new" routes.
export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    title: 'Sign in',
    loadComponent: () => import('./features/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell.component').then((m) => m.ShellComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Home',
        loadComponent: () => import('./features/home/home.page').then((m) => m.HomePage),
      },
      {
        path: 'account/password',
        title: 'Change password',
        loadComponent: () =>
          import('./features/account/change-password.page').then((m) => m.ChangePasswordPage),
      },
      {
        path: 'users',
        canActivate: [scopeGuard],
        data: { scope: 'users:list' },
        title: 'Users',
        loadComponent: () => import('./features/users/user-list.page').then((m) => m.UserListPage),
      },
      {
        path: 'users/new',
        canActivate: [scopeGuard],
        data: { scope: 'users:create' },
        title: 'New user',
        loadComponent: () => import('./features/users/user-form.page').then((m) => m.UserFormPage),
      },
      {
        path: 'users/:id',
        canActivate: [scopeGuard],
        data: { scope: 'users:update' },
        title: 'Edit user',
        loadComponent: () => import('./features/users/user-form.page').then((m) => m.UserFormPage),
      },
      {
        path: 'companies',
        canActivate: [scopeGuard],
        data: { scope: 'companies:list' },
        title: 'Companies',
        loadComponent: () =>
          import('./features/companies/company-list.page').then((m) => m.CompanyListPage),
      },
      {
        path: 'companies/new',
        canActivate: [scopeGuard],
        data: { scope: 'companies:create' },
        title: 'New company',
        loadComponent: () =>
          import('./features/companies/company-form.page').then((m) => m.CompanyFormPage),
      },
      {
        path: 'companies/:id',
        canActivate: [scopeGuard],
        data: { scope: 'companies:update' },
        title: 'Edit company',
        loadComponent: () =>
          import('./features/companies/company-form.page').then((m) => m.CompanyFormPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
