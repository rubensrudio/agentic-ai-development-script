import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { CompanyCreate, CompanyRead } from '@contracts/api.models';
import { Observable } from 'rxjs';

import { CompaniesApi } from '../../core/api/company.api';
import { apiErrorMessage } from '../../core/http-error';

/** Rejects values made only of whitespace (required fields). */
const NOT_BLANK = Validators.pattern(/\S/);

/** Field limits mirror CompanyBase in src/contracts/python/contracts/schemas.py. */
const LIMITS = { name: 150, legal_name: 200, tax_id: 32, phone: 32, address: 255 } as const;

function optional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

@Component({
  selector: 'app-company-form-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatSlideToggleModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../../shared/page.scss',
  template: `
    <div class="page-header">
      <h1>{{ isEdit() ? 'Edit company' : 'New company' }}</h1>
    </div>

    @if (loading()) {
      <mat-progress-bar mode="indeterminate" />
    } @else if (loadError()) {
      <div class="state error" role="alert">
        <p>{{ loadError() }}</p>
        <a mat-stroked-button routerLink="/companies">Back to companies</a>
      </div>
    } @else {
      <mat-card appearance="outlined">
        <mat-card-content>
          <form [formGroup]="form" (ngSubmit)="save()" novalidate>
            <div class="form">
              <mat-form-field appearance="outline">
                <mat-label>Name</mat-label>
                <input matInput formControlName="name" autocomplete="off" required />
                @if (
                  form.controls.name.hasError('required') || form.controls.name.hasError('pattern')
                ) {
                  <mat-error>Name is required.</mat-error>
                } @else if (form.controls.name.hasError('maxlength')) {
                  <mat-error>Use at most {{ limits.name }} characters.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Tax ID</mat-label>
                <input matInput formControlName="tax_id" autocomplete="off" required />
                @if (
                  form.controls.tax_id.hasError('required') ||
                  form.controls.tax_id.hasError('pattern')
                ) {
                  <mat-error>Tax ID is required.</mat-error>
                } @else if (form.controls.tax_id.hasError('maxlength')) {
                  <mat-error>Use at most {{ limits.tax_id }} characters.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline" class="full">
                <mat-label>Legal name</mat-label>
                <input matInput formControlName="legal_name" autocomplete="off" />
                @if (form.controls.legal_name.hasError('maxlength')) {
                  <mat-error>Use at most {{ limits.legal_name }} characters.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Email</mat-label>
                <input matInput type="email" formControlName="email" autocomplete="off" />
                @if (form.controls.email.hasError('email')) {
                  <mat-error>Enter a valid email address.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Phone</mat-label>
                <input matInput type="tel" formControlName="phone" autocomplete="off" />
                @if (form.controls.phone.hasError('maxlength')) {
                  <mat-error>Use at most {{ limits.phone }} characters.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline" class="full">
                <mat-label>Address</mat-label>
                <textarea matInput formControlName="address" rows="2"></textarea>
                @if (form.controls.address.hasError('maxlength')) {
                  <mat-error>Use at most {{ limits.address }} characters.</mat-error>
                }
              </mat-form-field>
            </div>

            <div class="toggles">
              <mat-slide-toggle formControlName="is_active">Active</mat-slide-toggle>
            </div>

            <div class="form-actions">
              <a mat-button routerLink="/companies">Cancel</a>
              <button mat-flat-button type="submit" [disabled]="saving()">
                {{ saving() ? 'Saving…' : 'Save' }}
              </button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>
    }
  `,
})
export class CompanyFormPage implements OnInit {
  private readonly api = inject(CompaniesApi);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  /** Route param, absent on the new route. */
  readonly id = input<string>();

  protected readonly limits = LIMITS;
  protected readonly isEdit = computed(() => this.id() !== undefined);
  protected readonly loading = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saving = signal(false);

  protected readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, NOT_BLANK, Validators.maxLength(LIMITS.name)],
    }),
    legal_name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(LIMITS.legal_name)],
    }),
    tax_id: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, NOT_BLANK, Validators.maxLength(LIMITS.tax_id)],
    }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.email] }),
    phone: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(LIMITS.phone)],
    }),
    address: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(LIMITS.address)],
    }),
    is_active: new FormControl(true, { nonNullable: true }),
  });

  ngOnInit(): void {
    if (!this.isEdit()) return;
    this.loading.set(true);
    this.api.get(Number(this.id())).subscribe({
      next: (company) => {
        this.patchForm(company);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loadError.set(apiErrorMessage(error, 'Could not load the company.'));
        this.loading.set(false);
      },
    });
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const body = this.buildBody();
    const id = this.id();
    const request: Observable<CompanyRead> =
      id === undefined ? this.api.create(body) : this.api.update(Number(id), body);

    this.saving.set(true);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.snackBar.open(id === undefined ? 'Company created.' : 'Company updated.', 'Close', {
          duration: 4000,
        });
        void this.router.navigate(['/companies']);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.snackBar.open(apiErrorMessage(error), 'Close', { duration: 6000 });
      },
    });
  }

  private patchForm(company: CompanyRead): void {
    this.form.setValue({
      name: company.name,
      legal_name: company.legal_name ?? '',
      tax_id: company.tax_id,
      email: company.email ?? '',
      phone: company.phone ?? '',
      address: company.address ?? '',
      is_active: company.is_active,
    });
  }

  /** Full body for both create and update; empty optional fields are sent as null. */
  private buildBody(): CompanyCreate {
    const value = this.form.getRawValue();
    return {
      name: value.name.trim(),
      legal_name: optional(value.legal_name),
      tax_id: value.tax_id.trim(),
      email: optional(value.email),
      phone: optional(value.phone),
      address: optional(value.address),
      is_active: value.is_active,
    };
  }
}
