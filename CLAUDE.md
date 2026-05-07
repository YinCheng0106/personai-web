# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **bun** (see `bun.lock`).

- `bun dev` — Next.js dev server with Turbopack
- `bun run build` / `bun start` — production build / serve
- `bun run lint` — flat-config ESLint (`eslint-config-next` core-web-vitals + typescript)
- `bun run typecheck` — `tsc --noEmit` (no test runner is configured)
- `bun run format` — Prettier write across `**/*.{ts,tsx}`
- `bunx shadcn@latest add <component>` — drop a shadcn/ui component into `src/components/ui` (style is `radix-luma`, base color `neutral`, icon library `hugeicons`)

## Architecture

**Stack:** Next.js 16 (App Router, RSC) + React 19 + Tailwind v4 + shadcn/ui + better-auth (Postgres). Source lives under `src/`; the only TS path alias is `@/* → ./src/*`.

**Routes (`src/app/`).** Four top-level pages share `RootLayout` (`layout.tsx`), which mounts `ThemeProvider` (next-themes) and the sticky `Navbar`:

- `/` dashboard — metric cards + weekly chart + goals + today's workouts
- `/analyze` — live camera + pose HUD; client component
- `/history` — heatmap + per-exercise summary + workout list
- `/inbody` — BMI/composition cards + calorie estimator

**Pose pipeline (the load-bearing part).** The `/analyze` page is wired against a Python backend that streams pose frames over WebSocket, but **currently consumes `useMockPose` instead of the real socket** for UI work without a backend running. The real adapter lives in `src/lib/socket.ts`:

- `connectAnalyzeSocket(exercise, weightKg, handlers)` opens `${NEXT_PUBLIC_WS_BASE}/ws/analyze/<exercise>?weight_kg=<n>` (default `ws://localhost:8000`).
- `normalizeFrame()` converts the server's snake_case `ServerFrame` (`rep_count`, `left_knee`, `is_visible`, …) into the camelCase `PoseData` the components consume. **All snake/camel translation lives here** — components only see `PoseData`.
- To switch `/analyze` from mock to live, replace `useMockPose` in `src/app/analyze/page.tsx` with a `useEffect` that calls `connectAnalyzeSocket` and pushes frames into state. The `PoseData` shape is identical.

**REST API (`src/lib/api.ts`).** Same backend at `${NEXT_PUBLIC_API_BASE}` (default `http://localhost:8000`). Endpoints: `/server`, `/wk/:userId[...]`, `/inbody/:userId[...]`. All requests go through one `request<T>()` helper; throws on non-2xx.

**Mock data (`src/lib/mock-data.ts`).** Currently every page imports `MOCK_*` constants directly rather than calling `api`. When wiring real data, swap these imports for `api.*` calls — the response types match (`WorkoutRecord`, `DailySummary`, `ExerciseSummary`, `InBody`).

**Auth (`src/lib/auth.ts`).** `better-auth` is initialized with a `pg.Pool` against `DATABASE_URL` and email/password enabled, but **no API route or middleware is wired up yet** — there is no `app/api/auth/[...all]/route.ts`. The Navbar avatar is a static "YC" placeholder.

**Component layout.**

- `src/components/ui/` — shadcn primitives + small bespoke wrappers (`metric-card`, `progress-bar`, `section-header`, `badge`).
- `src/components/layout/` — `Navbar`, `PageContainer` (every page wraps content in `PageContainer` for consistent header/title/action slot).
- `src/components/{dashboard,fitness,history,inbody}/` — feature-scoped composites. `fitness/` is the HUD: `CameraFrame` (react-camera-pro), `HUDOverlay`, `RepCounter`, `FsmStateIndicator`, `AngleDisplay`, `ErrorList`, `CalorieDisplay`.
- `src/types/` — domain types (`pose`, `workout`, `inbody`, `user`). `EXERCISE_LABEL` / `FSM_LABEL` in `pose.ts` and `FORM_ERROR_LABEL` in `lib/constants.ts` are the canonical zh-TW translation maps for backend enum values.

## Conventions

- Prettier: no semicolons, double quotes, 2-space, `trailingComma: es5`, 80-col, `prettier-plugin-tailwindcss` enabled with `tailwindFunctions: ["cn", "cva"]`. Run `bun run format` before committing UI changes — Tailwind class ordering is part of the diff.
- UI text is **zh-TW**. Backend enums (e.g. `"knee valgus detected"`, FSM states) are translated at the edge via the label maps above; don't hardcode Chinese strings against backend values elsewhere.
- Tailwind v4 uses `@theme inline` with OKLCH tokens in `src/app/globals.css`. Reference semantic colors (`bg-background`, `text-muted-foreground`, `border-border`, `text-success`, `text-warning`, `text-info`) rather than raw palette colors so dark mode works.
- Use `cn()` from `@/lib/utils` for conditional classes; HugeIcons via `<HugeiconsIcon icon={...} />`.

## Gotchas

- `components.json` and `.prettierrc` reference `app/globals.css`, but the file actually lives at `src/app/globals.css`. shadcn CLI and the prettier tailwind plugin may need that path corrected if you hit "stylesheet not found" issues.
- `src/components/theme-provider.tsx` and `src/lib/utils.ts` exist under `src/` but the original `components.json` aliases (`@/components`, `@/lib/utils`, etc.) resolve correctly via the tsconfig `@/* → ./src/*` mapping — don't "fix" them back to root-level paths.
- `src/store/` is empty; no global state manager is in use yet. Pages hold their own `useState`.
- `.env` currently has a duplicated key (`BETTER_AUTH_SECRET` defined twice — the second line is meant to be `BETTER_AUTH_URL`). `DATABASE_URL` is referenced by `lib/auth.ts` but not present in `.env`.
