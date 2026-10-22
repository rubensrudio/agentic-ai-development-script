// Mirror of python/contracts/permissions.py. Keep both in sync.

export const MODULES = ['users', 'companies'] as const;
export type Module = (typeof MODULES)[number];

export const ACTIONS = ['list', 'create', 'update', 'delete'] as const;
export type Action = (typeof ACTIONS)[number];

/** OAuth2 scope string, e.g. `companies:create`. */
export type Scope = `${Module}:${Action}`;

export function scope(module: Module, action: Action): Scope {
  return `${module}:${action}`;
}
