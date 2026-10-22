import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ListQuery, UserCreate, UserPage, UserRead, UserUpdate } from '@contracts/api.models';
import { Observable } from 'rxjs';

import { listParams } from './list-params';

/** CRUD client for `/api/users`. Errors surface as HttpErrorResponse (use apiErrorMessage). */
@Injectable({ providedIn: 'root' })
export class UsersApi {
  private readonly http = inject(HttpClient);
  private readonly url = '/api/users';

  list(query: ListQuery = {}): Observable<UserPage> {
    return this.http.get<UserPage>(this.url, { params: listParams(query) });
  }

  get(id: number): Observable<UserRead> {
    return this.http.get<UserRead>(`${this.url}/${id}`);
  }

  create(body: UserCreate): Observable<UserRead> {
    return this.http.post<UserRead>(this.url, body);
  }

  update(id: number, body: UserUpdate): Observable<UserRead> {
    return this.http.patch<UserRead>(`${this.url}/${id}`, body);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
