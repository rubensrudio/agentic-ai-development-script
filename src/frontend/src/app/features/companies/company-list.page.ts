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
import { PAGE_SIZE_DEFAULT, CompanyRead } from '@contracts/api.models';
import { debounceTime, distinctUntilChanged, filter, switchMap } from 'rxjs';

import { CompaniesApi } from '../../core/api/company.api';
import { AuthService } from '../../core/auth.service';
import { apiErrorMessage } from '../../core/http-error';
import { confirmAction } from '../../shared/confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-company-list-page',
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
      <h1>Companies</h1>
      @if (canCreate()) {
        <a mat-flat-button routerLink="/companies/new">
          <mat-icon fontSet="material-symbols-outlined">add</mat-icon>
          New company
        </a>
      }
    </div>

    <mat-form-field class="search" appearance="outline" subscriptSizing="dynamic">
      <mat-label>Search</mat-label>
      <mat-icon matPrefix fontSet="material-symbols-outlined">search</mat-icon>
      <input matInput [formControl]="search" placeholder="Name, legal name or tax ID" />
    </mat-form-field>

    <div class="table-wrapper">
      @if (companies.isLoading()) {
        <mat-progress-bar mode="indeterminate" />
      }

      @if (companies.error()) {
        <div class="state error" role="alert">
          <p>{{ errorMessage() }}</p>
          <button mat-stroked-button (click)="companies.reload()">Retry</button>
        </div>
      } @else {
        <table mat-table [dataSource]="rows()">
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>Name</th>
            <td mat-cell *matCellDef="let company">{{ company.name }}</td>
          </ng-container>
          <ng-container matColumnDef="tax_id">
            <th mat-header-cell *matHeaderCellDef>Tax ID</th>
            <td mat-cell *matCellDef="let company">{{ company.tax_id }}</td>
          </ng-container>
          <ng-container matColumnDef="email">
            <th mat-header-cell *matHeaderCellDef>Email</th>
            <td mat-cell *matCellDef="let company">{{ company.email ?? '—' }}</td>
          </ng-container>
          <ng-container matColumnDef="phone">
            <th mat-header-cell *matHeaderCellDef>Phone</th>
            <td mat-cell *matCellDef="let company">{{ company.phone ?? '—' }}</td>
          </ng-container>
          <ng-container matColumnDef="is_active">
            <th mat-header-cell *matHeaderCellDef>Active</th>
            <td mat-cell *matCellDef="let company">
              <span [class]="company.is_active ? 'yes' : 'no'">{{
                company.is_active ? 'Yes' : 'No'
              }}</span>
            </td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef class="actions-cell">
              <span class="cdk-visually-hidden">Actions</span>
            </th>
            <td mat-cell *matCellDef="let company" class="actions-cell">
              @if (canUpdate()) {
                <a
                  mat-icon-button
                  [routerLink]="['/companies', company.id]"
                  matTooltip="Edit"
                  [attr.aria-label]="'Edit ' + company.name"
                  data-testid="edit"
                >
                  <mat-icon fontSet="material-symbols-outlined">edit</mat-icon>
                </a>
              }
              @if (canDelete()) {
                <button
                  mat-icon-button
                  (click)="remove(company)"
                  matTooltip="Delete"
                  [attr.aria-label]="'Delete ' + company.name"
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

        @if (companies.hasValue() && rows().length === 0) {
          <div class="state">
            <p>{{ query() ? 'No companies match your search.' : 'No companies yet.' }}</p>
          </div>
        }

        <mat-paginator
          [length]="total()"
          [pageIndex]="pageIndex()"
          [pageSize]="pageSize()"
          [pageSizeOptions]="[10, 20, 50, 100]"
          (page)="onPage($event)"
          aria-label="Select page of companies"
        />
      }
    </div>
  `,
})
export class CompanyListPage {
  private readonly api = inject(CompaniesApi);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly search = new FormControl('', { nonNullable: true });
  protected readonly query = signal('');
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(PAGE_SIZE_DEFAULT);

  protected readonly canCreate = computed(() => this.auth.hasScope('companies:create'));
  protected readonly canUpdate = computed(() => this.auth.hasScope('companies:update'));
  protected readonly canDelete = computed(() => this.auth.hasScope('companies:delete'));
  protected readonly columns = computed(() => {
    const base = ['name', 'tax_id', 'email', 'phone', 'is_active'];
    return this.canUpdate() || this.canDelete() ? [...base, 'actions'] : base;
  });

  protected readonly companies = rxResource({
    params: () => ({ page: this.pageIndex() + 1, size: this.pageSize(), q: this.query() }),
    stream: ({ params }) => this.api.list(params),
  });
  protected readonly rows = computed(() =>
    this.companies.hasValue() ? this.companies.value().items : [],
  );
  protected readonly total = computed(() =>
    this.companies.hasValue() ? this.companies.value().total : 0,
  );
  protected readonly errorMessage = computed(() =>
    apiErrorMessage(
      this.companies.error()?.cause ?? this.companies.error(),
      'Could not load companies.',
    ),
  );

  constructor() {
    this.search.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((q) => {
        this.query.set(q.trim());
        this.pageIndex.set(0);
      });
  }

  protected onPage(event: PageEvent): void {
    this.pageSize.set(event.pageSize);
    this.pageIndex.set(event.pageIndex);
  }

  protected remove(company: CompanyRead): void {
    confirmAction(this.dialog, {
      title: 'Delete company',
      message: `Delete company "${company.name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
    })
      .pipe(
        filter(Boolean),
        switchMap(() => this.api.delete(company.id)),
      )
      .subscribe({
        next: () => {
          this.snackBar.open(`Company "${company.name}" deleted.`, 'Close', { duration: 4000 });
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
      this.companies.reload();
    }
  }
}
