import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MeRead, Scope, UserPage, UserRead } from '@contracts/api.models';
import { of } from 'rxjs';

import { UsersApi } from '../../core/api/user.api';
import { AuthService } from '../../core/auth.service';
import { UserListPage } from './user-list.page';

function makeUser(id: number, username: string, is_admin: boolean): UserRead {
  return {
    id,
    username,
    email: `${username}@example.com`,
    full_name: username,
    is_active: true,
    is_admin,
    permissions: [],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

const PAGE: UserPage = {
  items: [makeUser(1, 'me', false), makeUser(2, 'boss', true), makeUser(3, 'peer', false)],
  total: 3,
  page: 1,
  size: 20,
};

const ALL_SCOPES: Scope[] = ['users:list', 'users:update', 'users:delete'];

describe('UserListPage', () => {
  async function render(isAdmin: boolean): Promise<HTMLElement> {
    const me = { ...makeUser(1, 'me', isAdmin), scopes: ALL_SCOPES } as MeRead;
    await TestBed.configureTestingModule({
      imports: [UserListPage],
      providers: [
        provideRouter([]),
        {
          provide: UsersApi,
          useValue: { list: vi.fn().mockReturnValue(of(PAGE)), delete: vi.fn() },
        },
        {
          provide: AuthService,
          useValue: {
            currentUser: signal(me),
            hasScope: (s: Scope) => isAdmin || ALL_SCOPES.includes(s),
          },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(UserListPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function button(host: HTMLElement, action: 'Edit' | 'Delete', username: string): Element | null {
    return host.querySelector(`[aria-label="${action} ${username}"]`);
  }

  it('never offers to delete your own row', async () => {
    const host = await render(true);
    expect(button(host, 'Edit', 'me')).not.toBeNull();
    expect(button(host, 'Delete', 'me')).toBeNull();
    expect(button(host, 'Delete', 'peer')).not.toBeNull();
  });

  it('lets an admin edit and delete admin users', async () => {
    const host = await render(true);
    expect(button(host, 'Edit', 'boss')).not.toBeNull();
    expect(button(host, 'Delete', 'boss')).not.toBeNull();
  });

  it('hides edit and delete on admin rows for a non-admin', async () => {
    const host = await render(false);
    expect(button(host, 'Edit', 'boss')).toBeNull();
    expect(button(host, 'Delete', 'boss')).toBeNull();
    expect(button(host, 'Edit', 'peer')).not.toBeNull();
    expect(button(host, 'Delete', 'peer')).not.toBeNull();
    expect(button(host, 'Delete', 'me')).toBeNull();
  });
});
