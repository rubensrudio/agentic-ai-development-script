import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MeRead, PasswordChange, Scope, Token } from '@contracts/api.models';
import { Observable, catchError, firstValueFrom, map, of, switchMap, tap } from 'rxjs';

const TOKEN_KEY = 'access_token';

/** Holds the session: bearer token (localStorage) and the current user (`GET /api/me`). */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly tokenSignal = signal<string | null>(readToken());
  private readonly meSignal = signal<MeRead | null>(null);

  readonly token = this.tokenSignal.asReadonly();
  readonly currentUser = this.meSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.tokenSignal() !== null);

  login(username: string, password: string): Observable<MeRead> {
    const body = new HttpParams().set('username', username).set('password', password);
    return this.http
      .post<Token>('/api/auth/token', body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      .pipe(
        tap((token) => this.setToken(token.access_token)),
        switchMap(() => this.refreshMe()),
      );
  }

  /** Reload the current user (scopes may have changed). */
  refreshMe(): Observable<MeRead> {
    return this.http.get<MeRead>('/api/me').pipe(tap((me) => this.meSignal.set(me)));
  }

  /** Resolve the current user once per session; false when there is no valid session. */
  async ensureSession(): Promise<boolean> {
    if (!this.tokenSignal()) return false;
    if (this.meSignal()) return true;
    return firstValueFrom(
      this.refreshMe().pipe(
        map(() => true),
        catchError(() => {
          this.clear();
          return of(false);
        }),
      ),
    );
  }

  changePassword(body: PasswordChange): Observable<void> {
    return this.http.post<void>('/api/me/password', body);
  }

  hasScope(scope: Scope): boolean {
    const me = this.meSignal();
    return !!me && (me.is_admin || me.scopes.includes(scope));
  }

  logout(): void {
    this.clear();
    void this.router.navigate(['/login']);
  }

  /** Drop the session without navigating (used by the 401 interceptor). */
  clear(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage unavailable */
    }
    this.tokenSignal.set(null);
    this.meSignal.set(null);
  }

  private setToken(token: string): void {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* storage unavailable: session lasts until reload */
    }
    this.tokenSignal.set(token);
  }
}

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
