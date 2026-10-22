import { TitleCasePipe } from '@angular/common';
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
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import {
  ACTIONS,
  Action,
  MODULES,
  Module,
  ModulePermissions,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  USERNAME_PATTERN,
  UserCreate,
  UserRead,
  UserUpdate,
} from '@contracts/api.models';
import { Observable } from 'rxjs';

import { UsersApi } from '../../core/api/user.api';
import { AuthService } from '../../core/auth.service';
import { apiErrorMessage } from '../../core/http-error';

type ActionControls = Record<Action, FormControl<boolean>>;
type PermissionsGroup = FormGroup<Record<Module, FormGroup<ActionControls>>>;

/** Rejects values made only of whitespace (required text fields). */
const NOT_BLANK = Validators.pattern(/\S/);

const MODULE_LABELS: Record<Module, string> = { users: 'Users', companies: 'Companies' };

function buildPermissionsGroup(): PermissionsGroup {
  const modules = {} as Record<Module, FormGroup<ActionControls>>;
  for (const module of MODULES) {
    const actions = {} as ActionControls;
    for (const action of ACTIONS) {
      actions[action] = new FormControl(false, { nonNullable: true });
    }
    modules[module] = new FormGroup(actions);
  }
  return new FormGroup(modules);
}

@Component({
  selector: 'app-user-form-page',
  imports: [
    ReactiveFormsModule,
    TitleCasePipe,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatSlideToggleModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../../shared/page.scss',
  styles: `
    .matrix {
      overflow-x: auto;
      margin-bottom: 8px;

      table {
        border-collapse: collapse;
        min-width: 420px;
      }

      th,
      td {
        padding: 4px 12px;
        text-align: center;
      }

      th[scope='row'] {
        text-align: start;
        font-weight: 500;
      }
    }

    h2 {
      font: var(--mat-sys-title-medium);
      margin: 8px 0;
    }

    .hint {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
      margin: 0 0 8px;
    }
  `,
  template: `
    <div class="page-header">
      <h1>{{ isEdit() ? 'Edit user' : 'New user' }}</h1>
    </div>

    @if (loading()) {
      <mat-progress-bar mode="indeterminate" />
    } @else if (loadError()) {
      <div class="state error" role="alert">
        <p>{{ loadError() }}</p>
        <a mat-stroked-button routerLink="/users">Back to users</a>
      </div>
    } @else {
      <mat-card appearance="outlined">
        <mat-card-content>
          <form [formGroup]="form" (ngSubmit)="save()" novalidate>
            <div class="form">
              @if (isEdit()) {
                <mat-form-field appearance="outline">
                  <mat-label>Username</mat-label>
                  <input matInput [value]="original()?.username ?? ''" disabled />
                </mat-form-field>
              } @else {
                <mat-form-field appearance="outline">
                  <mat-label>Username</mat-label>
                  <input matInput formControlName="username" autocomplete="off" required />
                  @if (form.controls.username.hasError('required')) {
                    <mat-error>Username is required.</mat-error>
                  } @else if (form.controls.username.hasError('pattern')) {
                    <mat-error>Use only letters, digits, ".", "_" and "-".</mat-error>
                  } @else if (form.controls.username.hasError('minlength')) {
                    <mat-error>Use at least 3 characters.</mat-error>
                  } @else if (form.controls.username.hasError('maxlength')) {
                    <mat-error>Use at most 50 characters.</mat-error>
                  }
                </mat-form-field>
              }

              <mat-form-field appearance="outline">
                <mat-label>Full name</mat-label>
                <input matInput formControlName="full_name" autocomplete="off" required />
                @if (
                  form.controls.full_name.hasError('required') ||
                  form.controls.full_name.hasError('pattern')
                ) {
                  <mat-error>Full name is required.</mat-error>
                } @else if (form.controls.full_name.hasError('maxlength')) {
                  <mat-error>Use at most 120 characters.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Email</mat-label>
                <input matInput type="email" formControlName="email" autocomplete="off" required />
                @if (form.controls.email.hasError('required')) {
                  <mat-error>Email is required.</mat-error>
                } @else if (form.controls.email.hasError('email')) {
                  <mat-error>Enter a valid email address.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>{{ isEdit() ? 'Reset password' : 'Password' }}</mat-label>
                <input
                  matInput
                  type="password"
                  formControlName="password"
                  autocomplete="new-password"
                  [required]="!isEdit()"
                />
                @if (isEdit()) {
                  <mat-hint>Leave blank to keep the current password.</mat-hint>
                }
                @if (form.controls.password.hasError('required')) {
                  <mat-error>Password is required.</mat-error>
                } @else if (form.controls.password.hasError('minlength')) {
                  <mat-error>Use at least {{ passwordMin }} characters.</mat-error>
                } @else if (form.controls.password.hasError('maxlength')) {
                  <mat-error>Use at most {{ passwordMax }} characters.</mat-error>
                }
              </mat-form-field>
            </div>

            <div class="toggles">
              <mat-slide-toggle formControlName="is_active">Active</mat-slide-toggle>
              @if (isAdmin()) {
                <mat-slide-toggle formControlName="is_admin" data-testid="is-admin">
                  Administrator
                </mat-slide-toggle>
              }
            </div>
            @if (isSelf()) {
              <p class="hint">You cannot deactivate or demote yourself.</p>
            }

            @if (isAdmin()) {
              <section data-testid="permission-matrix">
                <h2>Permissions</h2>
                @if (form.controls.is_admin.value) {
                  <p class="hint">Administrators have every permission.</p>
                }
                <div class="matrix" formGroupName="permissions">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col"><span class="cdk-visually-hidden">Module</span></th>
                        @for (action of actions; track action) {
                          <th scope="col">{{ action | titlecase }}</th>
                        }
                      </tr>
                    </thead>
                    <tbody>
                      @for (module of modules; track module) {
                        <tr [formGroupName]="module">
                          <th scope="row">{{ moduleLabels[module] }}</th>
                          @for (action of actions; track action) {
                            <td>
                              <mat-checkbox
                                [formControlName]="action"
                                [aria-label]="moduleLabels[module] + ': ' + action"
                              />
                            </td>
                          }
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </section>
            }

            <div class="form-actions">
              <a mat-button routerLink="/users">Cancel</a>
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
export class UserFormPage implements OnInit {
  private readonly api = inject(UsersApi);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  /** Route param, absent on the new route. */
  readonly id = input<string>();

  protected readonly modules = MODULES;
  protected readonly actions = ACTIONS;
  protected readonly moduleLabels = MODULE_LABELS;
  protected readonly passwordMin = PASSWORD_MIN_LENGTH;
  protected readonly passwordMax = PASSWORD_MAX_LENGTH;

  protected readonly isEdit = computed(() => this.id() !== undefined);
  /** Only admins may see or send `is_admin` / `permissions`. */
  protected readonly isAdmin = computed(() => this.auth.currentUser()?.is_admin ?? false);
  protected readonly original = signal<UserRead | null>(null);
  protected readonly isSelf = computed(
    () => this.original() !== null && this.original()?.id === this.auth.currentUser()?.id,
  );
  protected readonly loading = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saving = signal(false);

  protected readonly form = new FormGroup({
    username: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(50),
        Validators.pattern(USERNAME_PATTERN),
      ],
    }),
    full_name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, NOT_BLANK, Validators.maxLength(120)],
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.minLength(PASSWORD_MIN_LENGTH),
        Validators.maxLength(PASSWORD_MAX_LENGTH),
      ],
    }),
    is_active: new FormControl(true, { nonNullable: true }),
    is_admin: new FormControl(false, { nonNullable: true }),
    permissions: buildPermissionsGroup(),
  });

  ngOnInit(): void {
    if (!this.isEdit()) {
      this.form.controls.password.addValidators(Validators.required);
      this.form.controls.password.updateValueAndValidity();
      return;
    }
    // Username is immutable: not part of the edit form.
    this.form.controls.username.disable();
    const id = Number(this.id());
    this.loading.set(true);
    this.api.get(id).subscribe({
      next: (user) => {
        this.original.set(user);
        this.patchForm(user);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loadError.set(apiErrorMessage(error, 'Could not load the user.'));
        this.loading.set(false);
      },
    });
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const original = this.original();
    let request: Observable<UserRead>;
    if (original) {
      const body = this.buildUpdate(original);
      if (Object.keys(body).length === 0) {
        this.snackBar.open('No changes to save.', 'Close', { duration: 3000 });
        return;
      }
      request = this.api.update(original.id, body);
    } else {
      request = this.api.create(this.buildCreate());
    }

    this.saving.set(true);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        if (this.isSelf()) {
          // Own profile changed: refresh the session copy (errors are handled by the interceptor).
          this.auth.refreshMe().subscribe({ error: () => undefined });
        }
        this.snackBar.open(original ? 'User updated.' : 'User created.', 'Close', {
          duration: 4000,
        });
        void this.router.navigate(['/users']);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.snackBar.open(apiErrorMessage(error), 'Close', { duration: 6000 });
      },
    });
  }

  private patchForm(user: UserRead): void {
    this.form.patchValue({
      full_name: user.full_name,
      email: user.email,
      is_active: user.is_active,
      is_admin: user.is_admin,
    });
    for (const row of user.permissions) {
      this.form.controls.permissions.controls[row.module]?.setValue(
        Object.fromEntries(ACTIONS.map((action) => [action, row[`can_${action}`]])) as Record<
          Action,
          boolean
        >,
      );
    }
    if (this.isSelf()) {
      this.form.controls.is_active.disable();
      this.form.controls.is_admin.disable();
    }
  }

  private permissionsValue(): ModulePermissions[] {
    const value = this.form.controls.permissions.getRawValue();
    return MODULES.map((module) => ({
      module,
      can_list: value[module].list,
      can_create: value[module].create,
      can_update: value[module].update,
      can_delete: value[module].delete,
    }));
  }

  private buildCreate(): UserCreate {
    const value = this.form.getRawValue();
    const body: UserCreate = {
      username: value.username.trim(),
      email: value.email.trim(),
      full_name: value.full_name.trim(),
      password: value.password,
      is_active: value.is_active,
    };
    if (this.isAdmin()) {
      body.is_admin = value.is_admin;
      body.permissions = this.permissionsValue();
    }
    return body;
  }

  /** PATCH body with only the changed fields; admin-only fields never leave a non-admin client. */
  private buildUpdate(original: UserRead): UserUpdate {
    const value = this.form.getRawValue();
    const body: UserUpdate = {};
    const email = value.email.trim();
    const fullName = value.full_name.trim();
    if (email !== original.email) body.email = email;
    if (fullName !== original.full_name) body.full_name = fullName;
    if (value.password) body.password = value.password;
    if (!this.isSelf() && value.is_active !== original.is_active) body.is_active = value.is_active;
    if (this.isAdmin()) {
      if (!this.isSelf() && value.is_admin !== original.is_admin) body.is_admin = value.is_admin;
      const permissions = this.permissionsValue();
      if (!samePermissions(permissions, original.permissions)) body.permissions = permissions;
    }
    return body;
  }
}

function samePermissions(a: ModulePermissions[], b: ModulePermissions[]): boolean {
  return MODULES.every((module) => {
    const left = a.find((row) => row.module === module);
    const right = b.find((row) => row.module === module);
    return ACTIONS.every(
      (action) => (left?.[`can_${action}`] ?? false) === (right?.[`can_${action}`] ?? false),
    );
  });
}
