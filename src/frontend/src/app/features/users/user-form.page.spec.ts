import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { MODULES, MeRead, UserRead } from '@contracts/api.models';
import { of } from 'rxjs';

import { UsersApi } from '../../core/api/user.api';
import { AuthService } from '../../core/auth.service';
import { UserFormPage } from './user-form.page';

function makeUser(overrides: Partial<UserRead> = {}): UserRead {
  return {
    id: 7,
    username: 'jdoe',
    email: 'jdoe@example.com',
    full_name: 'John Doe',
    is_active: true,
    is_admin: false,
    permissions: MODULES.map((module) => ({
      module,
      can_list: module === 'companies',
      can_create: false,
      can_update: false,
      can_delete: false,
    })),
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeMe(overrides: Partial<MeRead> = {}): MeRead {
  return { ...makeUser({ id: 1, username: 'me' }), scopes: ['users:update'], ...overrides };
}

describe('UserFormPage', () => {
  let fixture: ComponentFixture<UserFormPage>;
  let api: {
    get: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  const currentUser = signal<MeRead | null>(null);

  async function render(me: MeRead, id?: string, edited = makeUser()): Promise<HTMLElement> {
    currentUser.set(me);
    api.get.mockReturnValue(of(edited));
    fixture = TestBed.createComponent(UserFormPage);
    if (id !== undefined) fixture.componentRef.setInput('id', id);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function input(host: HTMLElement, name: string): HTMLInputElement {
    return host.querySelector(`[formcontrolname="${name}"]`) as HTMLInputElement;
  }

  function type(host: HTMLElement, name: string, value: string): void {
    const element = input(host, name);
    element.value = value;
    element.dispatchEvent(new Event('input'));
  }

  function submit(host: HTMLElement): void {
    host.querySelector('form')!.dispatchEvent(new Event('submit'));
  }

  beforeEach(async () => {
    api = {
      get: vi.fn(),
      create: vi.fn().mockReturnValue(of(makeUser())),
      update: vi.fn().mockReturnValue(of(makeUser())),
    };
    await TestBed.configureTestingModule({
      imports: [UserFormPage],
      providers: [
        provideRouter([]),
        { provide: UsersApi, useValue: api },
        {
          provide: AuthService,
          useValue: { currentUser, refreshMe: vi.fn().mockReturnValue(of(makeMe())) },
        },
      ],
    }).compileComponents();
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  it('shows the admin toggle and the permission matrix to admins', async () => {
    const host = await render(makeMe({ is_admin: true }));
    expect(host.querySelector('[data-testid="permission-matrix"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="is-admin"]')).not.toBeNull();
    expect(host.querySelectorAll('[data-testid="permission-matrix"] mat-checkbox').length).toBe(8);
  });

  it('hides the admin toggle and the permission matrix from non-admins', async () => {
    const host = await render(makeMe({ is_admin: false }), '7');
    expect(host.querySelector('[data-testid="permission-matrix"]')).toBeNull();
    expect(host.querySelector('[data-testid="is-admin"]')).toBeNull();
  });

  it('sends only changed fields and never admin fields when a non-admin edits', async () => {
    const host = await render(makeMe({ is_admin: false }), '7');
    expect(api.get).toHaveBeenCalledWith(7);
    type(host, 'full_name', 'Johnny Doe');
    submit(host);

    expect(api.update).toHaveBeenCalledTimes(1);
    const [id, body] = api.update.mock.calls[0];
    expect(id).toBe(7);
    expect(body).toEqual({ full_name: 'Johnny Doe' });
    expect(body).not.toHaveProperty('is_admin');
    expect(body).not.toHaveProperty('permissions');
  });

  it('includes the password only when filled', async () => {
    const host = await render(makeMe({ is_admin: false }), '7');
    type(host, 'password', 'new-secret-1');
    submit(host);
    expect(api.update.mock.calls[0][1]).toEqual({ password: 'new-secret-1' });
  });

  it('sends the whole permission matrix when an admin changes it', async () => {
    const host = await render(makeMe({ is_admin: true }), '7');
    const checkbox = host.querySelector('input[aria-label="Users: list"]') as HTMLInputElement;
    checkbox.click();
    fixture.detectChanges();
    submit(host);

    const body = api.update.mock.calls[0][1];
    expect(Object.keys(body)).toEqual(['permissions']);
    expect(body.permissions).toEqual([
      { module: 'users', can_list: true, can_create: false, can_update: false, can_delete: false },
      {
        module: 'companies',
        can_list: true,
        can_create: false,
        can_update: false,
        can_delete: false,
      },
    ]);
  });

  it('omits admin fields on create for non-admins', async () => {
    const host = await render(makeMe({ is_admin: false }));
    type(host, 'username', 'new.user');
    type(host, 'full_name', 'New User');
    type(host, 'email', 'new@example.com');
    type(host, 'password', 'secret-123');
    submit(host);

    expect(api.create).toHaveBeenCalledWith({
      username: 'new.user',
      email: 'new@example.com',
      full_name: 'New User',
      password: 'secret-123',
      is_active: true,
    });
  });

  it('requires a valid username and a password on create', async () => {
    const host = await render(makeMe({ is_admin: true }));
    type(host, 'username', 'bad name!');
    type(host, 'full_name', 'New User');
    type(host, 'email', 'new@example.com');
    submit(host);
    expect(api.create).not.toHaveBeenCalled();
  });

  it('rejects a whitespace-only full name inline', async () => {
    const host = await render(makeMe({ is_admin: false }), '7');
    type(host, 'full_name', '   ');
    submit(host);
    fixture.detectChanges();
    expect(api.update).not.toHaveBeenCalled();
    expect(host.querySelector('mat-error')?.textContent).toContain('Full name is required.');
  });

  it('locks is_active and is_admin when editing yourself', async () => {
    const me = makeMe({ id: 7, is_admin: true });
    const host = await render(me, '7', makeUser({ id: 7, is_admin: true }));
    const active = host.querySelector('mat-slide-toggle[formcontrolname="is_active"] button');
    const admin = host.querySelector('[data-testid="is-admin"] button');
    expect(active?.hasAttribute('disabled')).toBe(true);
    expect(admin?.hasAttribute('disabled')).toBe(true);
  });
});
