import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth.service';
import { apiErrorMessage } from '../../core/http-error';

@Component({
  selector: 'app-login-page',
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
        <mat-card-title>Sign in</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <mat-form-field>
            <mat-label>Username</mat-label>
            <input matInput formControlName="username" autocomplete="username" required />
            @if (form.controls.username.hasError('required')) {
              <mat-error>Username is required</mat-error>
            }
          </mat-form-field>

          <mat-form-field>
            <mat-label>Password</mat-label>
            <input
              matInput
              type="password"
              formControlName="password"
              autocomplete="current-password"
              required
            />
            @if (form.controls.password.hasError('required')) {
              <mat-error>Password is required</mat-error>
            }
          </mat-form-field>

          @if (error()) {
            <p class="error" role="alert">{{ error() }}</p>
          }

          <button mat-flat-button type="submit" [disabled]="submitting()">
            @if (submitting()) {
              <mat-progress-spinner mode="indeterminate" diameter="20" aria-label="Signing in" />
            } @else {
              Sign in
            }
          </button>
        </form>
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100%;
      padding: 16px;
      box-sizing: border-box;
    }
    .card {
      width: 100%;
      max-width: 400px;
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
    button mat-progress-spinner {
      margin: 0 auto;
    }
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Bound from the `returnUrl` query param set by authGuard. */
  readonly returnUrl = input<string | undefined>();

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  protected submit(): void {
    if (this.submitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { username, password } = this.form.getRawValue();
    this.submitting.set(true);
    this.error.set(null);
    this.auth.login(username.trim(), password).subscribe({
      next: () => void this.router.navigateByUrl(safeReturnUrl(this.returnUrl())),
      error: (err: unknown) => {
        this.error.set(apiErrorMessage(err));
        this.submitting.set(false);
      },
    });
  }
}

/** Only in-app absolute paths; anything else (e.g. `//evil.com`, `https://...`) falls back to home. */
function safeReturnUrl(url: string | undefined): string {
  return url && url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/\\') ? url : '/';
}
