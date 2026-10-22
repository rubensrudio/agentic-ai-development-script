import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Scope } from '@contracts/api.models';

import { AuthService } from './auth.service';

/** Requires a valid session; otherwise redirects to /login?returnUrl=... */
export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return (await auth.ensureSession())
    ? true
    : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/** Only for anonymous users (the login page); logged-in users go home. */
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  return (await auth.ensureSession()) ? inject(Router).createUrlTree(['/']) : true;
};

/** Requires `route.data.scope` (e.g. 'companies:list'); otherwise redirects home. Use after authGuard. */
export const scopeGuard: CanActivateFn = (route) => {
  const scope = route.data['scope'] as Scope | undefined;
  return !scope || inject(AuthService).hasScope(scope) ? true : inject(Router).createUrlTree(['/']);
};
