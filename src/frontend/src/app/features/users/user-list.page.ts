import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { PAGE_SIZE_DEFAULT, UserRead } from '@contracts/api.models';
import { debounceTime, distinctUntilChanged, filter, switchMap } from 'rxjs';

import { UsersApi } from '../../core/api/user.api';
import { AuthService } from '../../core/auth.service';
import { apiErrorMessage } from '../../core/http-error';
import { confirmAction } from '../../shared/confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-user-list-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatTableModule,
    MatTooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../../shared/page.scss',
  template: `
    <div class="page-header">
      <h1>Users</h1>
      @if (canCreate()) {
        <a mat-flat-button routerLink="/users/new">
          <mat-icon fontSet="material-symbols-outlined">add</mat-icon>
          New user
        </a>
      }
    </div>

    <mat-form-field class="search" appearance="outline" subscriptSizing="dynamic">
      <mat-label>Search</mat-label>
      <mat-icon matPrefix fontSet="material-symbols-outlined">search</mat-icon>
      <input matInput [formControl]="search" placeholder="Username, name or email" />
    </mat-form-field>

    <div class="table-wrapper">
      @if (users.isLoading()) {
        <mat-progress-bar mode="indeterminate" />
      }

      @if (users.error()) {
        <div class="state error" role="alert">
          <p>{{ errorMessage() }}</p>
          <button mat-stroked-button (click)="users.reload()">Retry</button>
        </div>
      } @else {
        <table mat-table [dataSource]="rows()">
          <ng-container matColumnDef="username">
            <th mat-header-cell *matHeaderCellDef>Username</th>
            <td mat-cell *matCellDef="let user">{{ user.username }}</td>
          </ng-container>
          <ng-container matColumnDef="full_name">
            <th mat-header-cell *matHeaderCellDef>Full name</th>
            <td mat-cell *matCellDef="let user">{{ user.full_name }}</td>
          </ng-container>
          <ng-container matColumnDef="email">
            <th mat-header-cell *matHeaderCellDef>Email</th>
            <td mat-cell *matCellDef="let user">{{ user.email }}</td>
          </ng-container>
          <ng-container matColumnDef="is_active">
            <th mat-header-cell *matHeaderCellDef>Active</th>
            <td mat-cell *matCellDef="let user">
              <span [class]="user.is_active ? 'yes' : 'no'">{{
                user.is_active ? 'Yes' : 'No'
              }}</span>
            </td>
          </ng-container>
          <ng-container matColumnDef="is_admin">
            <th mat-header-cell *matHeaderCellDef>Admin</th>
            <td mat-cell *matCellDef="let user">
              <span [class]="user.is_admin ? 'yes' : 'no'">{{ user.is_admin ? 'Yes' : 'No' }}</span>
            </td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef class="actions-cell">
              <span class="cdk-visually-hidden">Actions</span>
            </th>
            <td mat-cell *matCellDef="let user" class="actions-cell">
              @if (canEdit(user)) {
                <a
                  mat-icon-button
                  [routerLink]="['/users', user.id]"
                  matTooltip="Edit"
                  [attr.aria-label]="'Edit ' + user.username"
                  data-testid="edit"
                >
                  <mat-icon fontSet="material-symbols-outlined">edit</mat-icon>
                </a>
              }
              @if (canRemove(user)) {
                <button
                  mat-icon-button
                  (click)="remove(user)"
                  matTooltip="Delete"
                  [attr.aria-label]="'Delete ' + user.username"
                  data-testid="delete"
                >
                  <mat-icon fontSet="material-symbols-outlined">delete</mat-icon>
                </button>
              }
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="columns()"></tr>
          <tr mat-row *matRowDef="let row; columns: columns()"></tr>
        </table>

        @if (users.hasValue() && rows().length === 0) {
          <div class="state">
            <p>{{ query() ? 'No users match your search.' : 'No users yet.' }}</p>
          </div>
        }

        <mat-paginator
          [length]="total()"
          [pageIndex]="pageIndex()"
          [pageSize]="pageSize()"
          [pageSizeOptions]="[10, 20, 50, 100]"
          (page)="onPage($event)"
          aria-label="Select page of users"
        />
      }
    </div>
  `,
})
export class UserListPage {
  private readonly api = inject(UsersApi);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly search = new FormControl('', { nonNullable: true });
  protected readonly query = signal('');
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(PAGE_SIZE_DEFAULT);

  protected readonly canCreate = computed(() => this.auth.hasScope('users:create'));
  protected readonly canUpdate = computed(() => this.auth.hasScope('users:update'));
  protected readonly canDelete = computed(() => this.auth.hasScope('users:delete'));
  private readonly currentUser = this.auth.currentUser;
  protected readonly columns = computed(() => {
    const base = ['username', 'full_name', 'email', 'is_active', 'is_admin'];
    return this.canUpdate() || this.canDelete() ? [...base, 'actions'] : base;
  });

  protected readonly users = rxResource({
    params: () => ({ page: this.pageIndex() + 1, size: this.pageSize(), q: this.query() }),
    stream: ({ params }) => this.api.list(params),
  });
  protected readonly rows = computed(() => (this.users.hasValue() ? this.users.value().items : []));
  protected readonly total = computed(() => (this.users.hasValue() ? this.users.value().total : 0));
  protected readonly errorMessage = computed(() =>
    apiErrorMessage(this.users.error()?.cause ?? this.users.error(), 'Could not load users.'),
  );

  constructor() {
    this.search.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((q) => {
        this.query.set(q.trim());
        this.pageIndex.set(0);
      });
  }

  /** Non-admins cannot manage admin users (the API answers 403). */
  protected canEdit(user: UserRead): boolean {
    return this.canUpdate() && this.mayManage(user);
  }

  /** Nobody can delete themselves (400), and non-admins cannot delete admins (403). */
  protected canRemove(user: UserRead): boolean {
    return this.canDelete() && this.mayManage(user) && user.id !== this.currentUser()?.id;
  }

  protected onPage(event: PageEvent): void {
    this.pageSize.set(event.pageSize);
    this.pageIndex.set(event.pageIndex);
  }

  protected remove(user: UserRead): void {
    confirmAction(this.dialog, {
      title: 'Delete user',
      message: `Delete user "${user.username}"? This cannot be undone.`,
      confirmLabel: 'Delete',
    })
      .pipe(
        filter(Boolean),
        switchMap(() => this.api.delete(user.id)),
      )
      .subscribe({
        next: () => {
          this.snackBar.open(`User "${user.username}" deleted.`, 'Close', { duration: 4000 });
          this.afterDelete();
        },
        error: (error: unknown) =>
          this.snackBar.open(apiErrorMessage(error), 'Close', { duration: 6000 }),
      });
  }

  /** Step back a page when the last row of a non-first page was removed; otherwise reload. */
  private afterDelete(): void {
    if (this.rows().length === 1 && this.pageIndex() > 0) {
      this.pageIndex.update((index) => index - 1);
    } else {
      this.users.reload();
    }
  }

  private mayManage(user: UserRead): boolean {
    return !user.is_admin || (this.currentUser()?.is_admin ?? false);
  }
}
