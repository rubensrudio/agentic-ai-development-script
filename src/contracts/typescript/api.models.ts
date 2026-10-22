// Mirror of python/contracts/schemas.py (source of truth: ../openapi.json).
// All endpoints live under `/api`. Datetimes are ISO-8601 strings.
import { Module } from './permissions';

export * from './permissions';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]+$/;
export const PAGE_SIZE_DEFAULT = 20;
export const PAGE_SIZE_MAX = 100;

/** Error body for 4xx responses (except 422, which FastAPI returns as `{ detail: ValidationErrorItem[] }`). */
export interface ErrorResponse {
  detail: string;
}

export interface ValidationErrorItem {
  loc: (string | number)[];
  msg: string;
  type: string;
}

// --- Auth ---------------------------------------------------------------
// POST /api/auth/token  (Content-Type: application/x-www-form-urlencoded,
// fields: username, password). 401 on bad credentials or inactive user.
export interface Token {
  access_token: string;
  token_type: 'bearer';
  /** Seconds until expiry. */
  expires_in: number;
}

// POST /api/me/password -> 204. 400 { detail: "Current password is incorrect" }.
export interface PasswordChange {
  current_password: string;
  new_password: string;
}

// --- Permissions --------------------------------------------------------
export interface ModulePermissions {
  module: Module;
  can_list: boolean;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
}

// --- Users --------------------------------------------------------------
// GET /api/users?page&size&q -> UserPage           (users:list)
// POST /api/users -> 201 UserRead                   (users:create) 409 duplicate
// GET /api/users/{id} -> UserRead                   (users:list)
// PATCH /api/users/{id} -> UserRead                 (users:update)
// DELETE /api/users/{id} -> 204                     (users:delete) 400 self-delete
// is_admin / permissions are admin-only fields (403 otherwise).
export interface UserRead {
  id: number;
  username: string;
  email: string;
  full_name: string;
  is_active: boolean;
  is_admin: boolean;
  /** One entry per module, in MODULES order. */
  permissions: ModulePermissions[];
  created_at: string;
  updated_at: string;
}

export interface UserCreate {
  username: string;
  email: string;
  full_name: string;
  password: string;
  is_active?: boolean;
  is_admin?: boolean;
  permissions?: ModulePermissions[];
}

/** Only fields sent are changed; `permissions` replaces the whole matrix. Username is immutable. */
export interface UserUpdate {
  email?: string;
  full_name?: string;
  is_active?: boolean;
  is_admin?: boolean;
  /** Admin-style reset; no current password needed. */
  password?: string;
  permissions?: ModulePermissions[];
}

// GET /api/me -> MeRead (any authenticated user)
export interface MeRead extends UserRead {
  /** Effective scopes, e.g. ['companies:list']. Admins get every scope. */
  scopes: string[];
}

// --- Companies ----------------------------------------------------------
// Same CRUD shape as users under /api/companies with companies:* scopes.
// 409 { detail: "Tax ID already registered" }.
export interface CompanyRead {
  id: number;
  name: string;
  legal_name: string | null;
  tax_id: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  is_active: boolean;
  created_by_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyCreate {
  name: string;
  legal_name?: string | null;
  tax_id: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  is_active?: boolean;
}

export type CompanyUpdate = Partial<CompanyCreate>;

// --- Pagination ---------------------------------------------------------
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

export interface ListQuery {
  page?: number;
  size?: number;
  q?: string;
}

export type UserPage = Page<UserRead>;
export type CompanyPage = Page<CompanyRead>;
