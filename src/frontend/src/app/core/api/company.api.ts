import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  ListQuery,
  CompanyCreate,
  CompanyPage,
  CompanyRead,
  CompanyUpdate,
} from '@contracts/api.models';
import { Observable } from 'rxjs';

import { listParams } from './list-params';

/** CRUD client for `/api/companies`. Errors surface as HttpErrorResponse (use apiErrorMessage). */
@Injectable({ providedIn: 'root' })
export class CompaniesApi {
  private readonly http = inject(HttpClient);
  private readonly url = '/api/companies';

  list(query: ListQuery = {}): Observable<CompanyPage> {
    return this.http.get<CompanyPage>(this.url, { params: listParams(query) });
  }

  get(id: number): Observable<CompanyRead> {
    return this.http.get<CompanyRead>(`${this.url}/${id}`);
  }

  create(body: CompanyCreate): Observable<CompanyRead> {
    return this.http.post<CompanyRead>(this.url, body);
  }

  update(id: number, body: CompanyUpdate): Observable<CompanyRead> {
    return this.http.patch<CompanyRead>(`${this.url}/${id}`, body);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
