import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@contracts/api.models';
import { of, throwError } from 'rxjs';

import { AuthService } from '../../core/auth.service';
import { ChangePasswordPage } from './change-password.page';

describe('ChangePasswordPage', () => {
  let changePassword: ReturnType<typeof vi.fn>;
  let open: ReturnType<typeof vi.fn>;

  async function setup() {
    changePassword = vi.fn();
    open = vi.fn();
    await TestBed.configureTestingModule({
      imports: [ChangePasswordPage],
      providers: [
        { provide: AuthService, useValue: { changePassword } },
        { provide: MatSnackBar, useValue: { open } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ChangePasswordPage);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  function fill(el: HTMLElement, current: string, next: string, confirm: string) {
    const inputs = Array.from(el.querySelectorAll('input'));
    [current, next, confirm].forEach((value, i) => {
      inputs[i].value = value;
      inputs[i].dispatchEvent(new Event('input'));
    });
  }

  async function submit(fixture: { whenStable(): Promise<unknown> }, el: HTMLElement) {
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  it('requires all fields', async () => {
    const { fixture, el } = await setup();
    await submit(fixture, el);
    expect(changePassword).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Current password is required');
    expect(el.textContent).toContain('New password is required');
    expect(el.textContent).toContain('Please confirm the new password');
  });

  it('rejects a new password shorter than the minimum', async () => {
    const { fixture, el } = await setup();
    const short = 'a'.repeat(PASSWORD_MIN_LENGTH - 1);
    fill(el, 'old-password', short, short);
    await submit(fixture, el);
    expect(changePassword).not.toHaveBeenCalled();
    expect(el.textContent).toContain(`Must be at least ${PASSWORD_MIN_LENGTH} characters`);
  });

  it('rejects a new password longer than the maximum', async () => {
    const { fixture, el } = await setup();
    const long = 'a'.repeat(PASSWORD_MAX_LENGTH + 1);
    fill(el, 'old-password', long, long);
    await submit(fixture, el);
    expect(changePassword).not.toHaveBeenCalled();
    expect(el.textContent).toContain(`Must be at most ${PASSWORD_MAX_LENGTH} characters`);
  });

  it('rejects mismatched confirmation', async () => {
    const { fixture, el } = await setup();
    fill(el, 'old-password', 'new-password-1', 'new-password-2');
    await submit(fixture, el);
    expect(changePassword).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Passwords do not match');
  });

  it('rejects a new password equal to the current one', async () => {
    const { fixture, el } = await setup();
    fill(el, 'same-password', 'same-password', 'same-password');
    await submit(fixture, el);
    expect(changePassword).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Must be different from the current password');
  });

  it('calls the service, shows a snackbar and resets the form on success', async () => {
    const { fixture, el } = await setup();
    changePassword.mockReturnValue(of(undefined));
    fill(el, 'old-password', 'new-password', 'new-password');
    await submit(fixture, el);
    expect(changePassword).toHaveBeenCalledWith({
      current_password: 'old-password',
      new_password: 'new-password',
    });
    expect(open).toHaveBeenCalledWith('Password changed successfully.', 'Close', expect.anything());
    const inputs = Array.from(el.querySelectorAll('input'));
    expect(inputs.every((input) => input.value === '')).toBe(true);
    expect(el.querySelector('mat-error')).toBeNull();
  });

  it('shows the API error message on failure', async () => {
    const { fixture, el } = await setup();
    changePassword.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { detail: 'Current password is incorrect' },
          }),
      ),
    );
    fill(el, 'wrong-password', 'new-password', 'new-password');
    await submit(fixture, el);
    expect(el.querySelector('[role=alert]')?.textContent).toContain(
      'Current password is incorrect',
    );
    expect(open).not.toHaveBeenCalled();
    expect(el.querySelector<HTMLButtonElement>('button[type=submit]')!.disabled).toBe(false);
  });
});
