import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { MeRead } from '@contracts/api.models';
import { Subject, of, throwError } from 'rxjs';

import { AuthService } from '../../core/auth.service';
import { LoginPage } from './login.page';

describe('LoginPage', () => {
  let login: ReturnType<typeof vi.fn>;
  let navigateByUrl: ReturnType<typeof vi.fn>;

  async function setup(returnUrl?: string) {
    login = vi.fn();
    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [provideRouter([]), { provide: AuthService, useValue: { login } }],
    }).compileComponents();
    navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(LoginPage);
    if (returnUrl !== undefined) fixture.componentRef.setInput('returnUrl', returnUrl);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  function fill(el: HTMLElement, username: string, password: string) {
    const [user, pass] = Array.from(el.querySelectorAll('input'));
    user.value = username;
    user.dispatchEvent(new Event('input'));
    pass.value = password;
    pass.dispatchEvent(new Event('input'));
  }

  function submit(el: HTMLElement) {
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
  }

  it('shows required errors and does not call the service on an empty form', async () => {
    const { fixture, el } = await setup();
    submit(el);
    await fixture.whenStable();
    expect(login).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Username is required');
    expect(el.textContent).toContain('Password is required');
  });

  it('logs in and navigates home by default', async () => {
    const { fixture, el } = await setup();
    login.mockReturnValue(of({} as MeRead));
    fill(el, '  alice ', 'secret123');
    submit(el);
    await fixture.whenStable();
    expect(login).toHaveBeenCalledWith('alice', 'secret123');
    expect(navigateByUrl).toHaveBeenCalledWith('/');
  });

  it('navigates to returnUrl on success', async () => {
    const { fixture, el } = await setup('/companies');
    login.mockReturnValue(of({} as MeRead));
    fill(el, 'alice', 'secret123');
    submit(el);
    await fixture.whenStable();
    expect(navigateByUrl).toHaveBeenCalledWith('/companies');
  });

  it('ignores an external returnUrl', async () => {
    const { fixture, el } = await setup('//evil.example.com');
    login.mockReturnValue(of({} as MeRead));
    fill(el, 'alice', 'secret123');
    submit(el);
    await fixture.whenStable();
    expect(navigateByUrl).toHaveBeenCalledWith('/');
  });

  it('disables the button while submitting', async () => {
    const { fixture, el } = await setup();
    const pending = new Subject<MeRead>();
    login.mockReturnValue(pending);
    fill(el, 'alice', 'secret123');
    submit(el);
    await fixture.whenStable();
    const button = el.querySelector<HTMLButtonElement>('button[type=submit]')!;
    expect(button.disabled).toBe(true);
    expect(el.querySelector('mat-progress-spinner')).not.toBeNull();
    pending.next({} as MeRead);
  });

  it('shows the API error message and re-enables the button', async () => {
    const { fixture, el } = await setup();
    login.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 401,
            error: { detail: 'Incorrect username or password' },
          }),
      ),
    );
    fill(el, 'alice', 'wrong-pass');
    submit(el);
    await fixture.whenStable();
    expect(el.querySelector('[role=alert]')?.textContent).toContain(
      'Incorrect username or password',
    );
    expect(el.querySelector<HTMLButtonElement>('button[type=submit]')!.disabled).toBe(false);
    expect(navigateByUrl).not.toHaveBeenCalled();
  });
});
