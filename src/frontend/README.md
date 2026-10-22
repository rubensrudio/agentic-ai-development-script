# Frontend

Angular 22 + Angular Material client for the App API. See the
[root README](../../README.md) for setup.

| Command | Description |
|---|---|
| `npm start` | Dev server on <http://localhost:4200>, proxying `/api` to `localhost:8000` |
| `npm run build` | Production build in `dist/frontend/browser` |
| `npm run typecheck` | Type-check app and specs |
| `npm run test:ci` | Unit tests (Vitest), single run |

Structure: `src/app/core` (auth, guards, interceptor, API clients),
`src/app/layout` (shell), `src/app/features/*` (pages), `src/app/shared`
(reusable components). API types come from `@contracts/*`
(`src/contracts/typescript`).
