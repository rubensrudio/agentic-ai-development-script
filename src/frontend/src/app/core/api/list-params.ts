import { HttpParams } from '@angular/common/http';
import { ListQuery } from '@contracts/api.models';

export function listParams(query: ListQuery = {}): HttpParams {
  let params = new HttpParams();
  if (query.page) params = params.set('page', query.page);
  if (query.size) params = params.set('size', query.size);
  if (query.q?.trim()) params = params.set('q', query.q.trim());
  return params;
}
