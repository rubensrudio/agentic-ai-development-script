import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import {
  AbstractControl,
  FormGroupDirective,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@contracts/api.models';

import { AuthService } from '../../core/auth.service';
import { apiErrorMessage } from '../../core/http-error';

/** Group-level checks: new password differs from the current one and matches the confirmation. */
export const passwordChangeValidator: ValidatorFn = (
  group: AbstractControl,
): ValidationErrors | null => {
  const current = group.get('currentPassword')?.value as string;
  const next = group.get('newPassword')?.value as string;
  const confirm = group.get('confirmPassword')?.value as string;
  const errors: ValidationErrors = {};
  if (next && current && next === current) errors['sameAsCurrent'] = true;
  if (confirm && next !== confirm) errors['mismatch'] = true;
  return Object.keys(errors).length ? errors : null;
};

/** Shows a field as invalid when the group carries the given error and the field was touched. */
function groupErrorMatcher(errorKey: string): ErrorStateMatcher {
  return {
    isErrorState: (control) =>
      !!control &&
      (control.invalid || !!control.parent?.hasError(errorKey)) &&
      (control.touched || control.dirty),
  };
}

@Component({
  selector: 'app-change-password-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <mat-card class="card" appearance="outlined">
      <mat-card-header>
        <mat-card-title>Change password</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <mat-form-field>
            <mat-label>Current password</mat-label>
            <input
              matInput
              type="password"
              formControlName="currentPassword"
              autocomplete="current-password"
              required
            />
            @if (form.controls.currentPassword.hasError('required')) {
              <mat-error>Current password is required</mat-error>
            }
          </mat-form-field>

          <mat-form-field>
            <mat-label>New password</mat-label>
            <input
              matInput
              type="password"
              formControlName="newPassword"
              autocomplete="new-password"
              required
              [errorStateMatcher]="sameAsCurrentMatcher"
            />
            <mat-hint>{{ minLength }}–{{ maxLength }} characters</mat-hint>
            @if (form.controls.newPassword.hasError('required')) {
              <mat-error>New password is required</mat-error>
            } @else if (form.controls.newPassword.hasError('minlength')) {
              <mat-error>Must be at least {{ minLength }} characters</mat-error>
            } @else if (form.controls.newPassword.hasError('maxlength')) {
              <mat-error>Must be at most {{ maxLength }} characters</mat-error>
            } @else if (form.hasError('sameAsCurrent')) {
              <mat-error>Must be different from the current password</mat-error>
            }
          </mat-form-field>

          <mat-form-field>
            <mat-label>Confirm new password</mat-label>
            <input
              matInput
              type="password"
              formControlName="confirmPassword"
              autocomplete="new-password"
              required
              [errorStateMatcher]="mismatchMatcher"
            />
            @if (form.controls.confirmPassword.hasError('required')) {
              <mat-error>Please confirm the new password</mat-error>
            } @else if (form.hasError('mismatch')) {
              <mat-error>Passwords do not match</mat-error>
            }
          </mat-form-field>

          @if (error()) {
            <p class="error" role="alert">{{ error() }}</p>
          }

          <div class="actions">
            <button mat-flat-button type="submit" [disabled]="submitting()">
              @if (submitting()) {
                <mat-progress-spinner mode="indeterminate" diameter="20" aria-label="Saving" />
              } @else {
                Change password
              }
            </button>
          </div>
        </form>
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    .card {
      max-width: 480px;
    }
    form {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding-top: 16px;
    }
    mat-form-field {
      width: 100%;
    }
    .error {
      color: var(--mat-sys-error);
      margin: 0 0 12px;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
    }
    button {
      min-width: 160px;
    }
    button mat-progress-spinner {
      margin: 0 auto;
    }
  `,
})
export class ChangePasswordPage {
  private readonly auth = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly formDirective = viewChild.required(FormGroupDirective);

  protected readonly minLength = PASSWORD_MIN_LENGTH;
  protected readonly maxLength = PASSWORD_MAX_LENGTH;
  protected readonly sameAsCurrentMatcher = groupErrorMatcher('sameAsCurrent');
  protected readonly mismatchMatcher = groupErrorMatcher('mismatch');

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group(
    {
      currentPassword: ['', Validators.required],
      newPassword: [
        '',
        [
          Validators.required,
          Validators.minLength(PASSWORD_MIN_LENGTH),
          Validators.maxLength(PASSWORD_MAX_LENGTH),
        ],
      ],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordChangeValidator },
  );

  protected submit(): void {
    if (this.submitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { currentPassword, newPassword } = this.form.getRawValue();
    this.submitting.set(true);
    this.error.set(null);
    this.auth
      .changePassword({ current_password: currentPassword, new_password: newPassword })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          // Reset through the directive so `submitted` is cleared and no errors show.
          this.formDirective().resetForm();
          this.snackBar.open('Password changed successfully.', 'Close', { duration: 4000 });
        },
        error: (err: unknown) => {
          this.error.set(apiErrorMessage(err));
          this.submitting.set(false);
        },
      });
  }
}
