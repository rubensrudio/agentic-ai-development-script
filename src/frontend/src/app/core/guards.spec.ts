import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { Scope } from '@contracts/api.models';

import { AuthService } from './auth.service';
import { scopeGuard } from './guards';

describe('scopeGuard', () => {
  function run(granted: Scope[], required: Scope | Scope[] | undefined): boolean | UrlTree {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { hasScope: (s: Scope) => granted.includes(s) } },
      ],
    });
    const route = {
      data: required === undefined ? {} : { scope: required },
    } as unknown as ActivatedRouteSnapshot;
    return TestBed.runInInjectionContext(
      () => scopeGuard(route, {} as RouterStateSnapshot) as boolean | UrlTree,
    );
  }

  it('allows routes without a scope', () => {
    expect(run([], undefined)).toBe(true);
  });

  it('allows a single granted scope', () => {
    expect(run(['users:list'], 'users:list')).toBe(true);
  });

  it('allows a list when every scope is granted', () => {
    expect(run(['users:list', 'users:update'], ['users:list', 'users:update'])).toBe(true);
  });

  it('redirects home when any scope of a list is missing', () => {
    const denied = run(['users:update'], ['users:list', 'users:update']);
    expect(denied).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(denied as UrlTree)).toBe('/');
  });
});
