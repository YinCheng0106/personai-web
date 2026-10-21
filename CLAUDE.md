# PersonAI frontend development

Read [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/TESTING.md](docs/TESTING.md) for setup, quality gates, review expectations, and test boundaries. Use Bun and preserve `bun.lock`. UI copy uses Traditional Chinese (Taiwan); code identifiers and Conventional Commit messages use English.

## Commands

- `bun run dev` / `bun run dev:https`: Next.js development server
- `bun run lint`: ESLint
- `bun run typecheck`: `tsc --noEmit`
- `bun run test`: Vitest, React Testing Library, and MSW
- `bun run test:coverage`: V8 coverage, HTML, LCOV, and JUnit
- `bun run test:e2e`: Playwright Chromium tests
- `bun run build` / `bun run start`: production build / server
- `bun run auth:migrate`: Better Auth schema migration against the configured development database

## Current architecture

Next.js 16 App Router, React 19, TypeScript, Tailwind v4, and shadcn primitives live in `src/`. The alias is `@/*` → `src/*`.

- `/`, `/history`, and `/inbody` use the authenticated REST client in `src/lib/api.ts`. Requests target `/wk/me`, `/body-profile/me`, and related endpoints. The legacy `/inbody/me` adapter remains for compatibility.
- Better Auth lives in `src/lib/auth.ts`, with a PostgreSQL pool scoped to `personai_auth`, JWT/JWKS support, and the route `src/app/api/auth/[...all]/route.ts`. Client session/token access is in `src/lib/auth-client.ts`. `RequireAuth` controls private page content.
- `/analyze` uses `src/hooks/use-pose-analysis.ts`, browser camera video, MediaPipe PoseLandmarker, and `connectAnalyzeSocket`. Raw video stays in the browser. The hook sends 33 keypoints or explicit `pose_missing`, with increasing frame ids and timestamps.
- `src/lib/socket.ts` normalizes server frames and provides Analyze and PK WebSocket adapters. JWTs travel as `["personai.v1", token]` subprotocols, never query parameters. Analyze connects to `/ws/analyze/{exercise}` without a frontend weight override.
- `/pk` shares the pose hook and uses a separate authenticated `/ws/pk` room socket. Only confirmed ACTIVE repetitions generate score updates; readiness and room lifecycle retain the existing protocol.
- `/inbody` represents Body Profile `unknown`, `basic`, and `measured` states, with separate basic and measured data forms. Nullable values remain unknown; BMI and derived fields come from the API.

Keep snake_case → camelCase mapping at the API/socket boundary. Tracking hints are separate from form errors and must not increase workout error counts. Missing angles/calories are `null`; numeric zero remains a valid value. See [Pose Visibility Tracking Contract](docs/Pose_Visibility_Tracking_Contract_v1.md) before editing related behavior.

## Conventions and validation

Use semantic theme tokens, `cn()` for conditional classes, and the existing enum/label maps for zh-TW copy. Prettier uses no semicolons, double quotes, two spaces, and the Tailwind plugin. Format only the files in scope when unrelated work is present.

Vitest tests isolate remote services and hardware. Playwright includes fully mocked frontend cases and local Better Auth/PostgreSQL cases with mocked FastAPI. Neither establishes real cross-service integration or real-person pose accuracy. Do not describe a successful API mock, coverage threshold, or build as evidence of those behaviors.
