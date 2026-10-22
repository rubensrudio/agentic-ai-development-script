import { HttpErrorResponse } from '@angular/common/http';
import { ErrorResponse, ValidationErrorItem } from '@contracts/api.models';

/** Human-readable message from an API error (string `detail`, 422 list, or network error). */
export function apiErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (!(error instanceof HttpErrorResponse)) return fallback;
  if (error.status === 0) return 'Cannot reach the server. Check your connection.';
  const detail = (error.error as Partial<ErrorResponse> | { detail?: ValidationErrorItem[] } | null)
    ?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    return detail.map((item) => `${item.loc.at(-1)}: ${item.msg}`).join('; ');
  }
  return fallback;
}
