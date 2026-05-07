# PersonAI

**English** | [繁體中文](./README.zh-TW.md)

> An AI-powered personal fitness companion — real-time pose analysis, workout tracking, and body composition insights in one streamlined web app.

PersonAI is the web frontend for an AI personal trainer. It pairs a live camera-based pose pipeline with a workout history dashboard and body-composition tools, giving users actionable feedback on form, reps, and progress without leaving the browser.

## Key Features

- **Live Pose Analysis** — Streams camera frames to a Python backend over WebSocket and renders a HUD with rep counter, FSM state, joint angles, calorie estimate, and real-time form-error callouts.
- **Dashboard** — Daily metric cards, weekly activity chart, goal progress, and today's workout list at a glance.
- **Workout History** — Activity heatmap, per-exercise summaries, and a chronological workout log.
- **InBody Insights** — BMI and body-composition cards plus a calorie estimator for planning sessions.
- **Theming** — Light/dark mode powered by `next-themes` with OKLCH design tokens.
- **Auth-ready** — `better-auth` configured against Postgres with email/password (routes to be wired up).
- **Localized UI** — All user-facing copy is in Traditional Chinese (zh-TW); backend enums are translated at the edge via canonical label maps.

## Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org/) (App Router, React Server Components, Turbopack)
- **Language:** [TypeScript](https://www.typescriptlang.org/) 5
- **UI:** [React 19](https://react.dev/), [Tailwind CSS v4](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/) (`radix-luma` style), [HugeIcons](https://hugeicons.com/)
- **Auth:** [better-auth](https://www.better-auth.com/) + PostgreSQL (`pg`)
- **Camera & Pose:** [`react-camera-pro`](https://www.npmjs.com/package/react-camera-pro) + WebSocket adapter to a Python pose backend
- **Tooling:** [Bun](https://bun.sh/) (package manager & runtime), ESLint (flat config), Prettier with `prettier-plugin-tailwindcss`

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) ≥ 1.0 (npm/pnpm/yarn also work, but `bun.lock` is the source of truth)
- Node.js ≥ 20 (only required if you opt out of Bun)
- A running [PersonAI backend](https://github.com/YinCheng0106/personai-api) for live pose analysis and REST data (optional — the app ships with mock data)
- PostgreSQL (only required when you wire up `better-auth`)

### Installation

```bash
# Clone
git clone https://github.com/YinCheng0106/personai-web.git
cd personai-web

# Install dependencies
bun install
# or: npm install / pnpm install / yarn
```

### Environment Variables

Copy `.env.sample` to `.env.local` and fill in the values:

```bash
cp .env.sample .env.local
```

| Variable                | Description                                                                 | Default                  |
| ----------------------- | --------------------------------------------------------------------------- | ------------------------ |
| `NEXT_PUBLIC_API_BASE`  | REST base URL for the PersonAI backend.                                     | `http://localhost:8000`  |
| `NEXT_PUBLIC_WS_BASE`   | WebSocket base URL used by `connectAnalyzeSocket` for live pose streaming.  | `ws://localhost:8000`    |
| `DATABASE_URL`          | PostgreSQL connection string consumed by `better-auth`.                     | —                        |
| `BETTER_AUTH_SECRET`    | Secret used to sign auth tokens (generate with `openssl rand -base64 32`).  | —                        |
| `BETTER_AUTH_URL`       | Public base URL of this app (e.g. `http://localhost:3000`).                 | —                        |

### Available Scripts

| Command              | Description                                              |
| -------------------- | -------------------------------------------------------- |
| `bun dev`            | Start the Next.js dev server with Turbopack.             |
| `bun run build`      | Create a production build.                               |
| `bun start`          | Serve the production build.                              |
| `bun run lint`       | Run ESLint (flat config, `eslint-config-next`).          |
| `bun run typecheck`  | Type-check the project with `tsc --noEmit`.              |
| `bun run format`     | Format `**/*.{ts,tsx}` with Prettier.                    |

Open [http://localhost:3000](http://localhost:3000) once the dev server is running.

### Adding shadcn/ui Components

```bash
bunx shadcn@latest add <component>
```

Components land in `src/components/ui/` using the `radix-luma` style with `neutral` base color and HugeIcons.

### Switching from Mock to Live Data

- **Pose stream:** in `src/app/analyze/page.tsx`, replace `useMockPose` with a `useEffect` that calls `connectAnalyzeSocket(...)` from `src/lib/socket.ts`. The `PoseData` shape is identical — all snake/camel translation lives in `normalizeFrame()`.
- **REST data:** swap `MOCK_*` imports from `src/lib/mock-data.ts` for the matching helpers in `src/lib/api.ts`. Response types (`WorkoutRecord`, `DailySummary`, `ExerciseSummary`, `InBody`) align 1:1.

## Project Structure

```
personai-web/
├── public/                       # Static assets
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── layout.tsx            # Root layout (ThemeProvider + Navbar)
│   │   ├── page.tsx              # Dashboard
│   │   ├── analyze/              # Live camera + pose HUD
│   │   ├── history/              # Heatmap + workout log
│   │   ├── inbody/               # Body composition + calorie tools
│   │   └── globals.css           # Tailwind v4 @theme tokens (OKLCH)
│   ├── components/
│   │   ├── ui/                   # shadcn primitives & wrappers
│   │   ├── layout/               # Navbar, PageContainer
│   │   ├── dashboard/            # Dashboard composites
│   │   ├── fitness/              # Pose HUD (camera, overlay, rep counter, …)
│   │   ├── history/              # History views
│   │   ├── inbody/               # InBody views
│   │   └── theme-provider.tsx    # next-themes wrapper
│   ├── hooks/
│   │   └── use-mock-pose.ts      # Mock pose stream for offline UI work
│   ├── lib/
│   │   ├── api.ts                # REST client (request<T>() helper)
│   │   ├── socket.ts             # WebSocket adapter + frame normalization
│   │   ├── auth.ts               # better-auth init
│   │   ├── mock-data.ts          # MOCK_* fixtures
│   │   ├── constants.ts          # Label maps (zh-TW translations)
│   │   ├── format.ts             # Display formatters
│   │   └── utils.ts              # cn() and shared utilities
│   └── types/                    # Domain types: pose, workout, inbody, user
├── components.json               # shadcn/ui config
├── eslint.config.mjs             # ESLint flat config
├── next.config.mjs               # Next.js config
├── postcss.config.mjs            # PostCSS (Tailwind v4)
├── tsconfig.json                 # Path alias: @/* → ./src/*
└── package.json
```

## Conventions

- **Formatting:** no semicolons, double quotes, 2-space indent, `trailingComma: es5`, 80-column lines. Tailwind class ordering is enforced via `prettier-plugin-tailwindcss` — run `bun run format` before committing UI changes.
- **Styling:** reference semantic tokens (`bg-background`, `text-muted-foreground`, `border-border`, `text-success`, `text-warning`, `text-info`) so dark mode works automatically.
- **Localization:** UI copy is zh-TW. Translate backend enums via the label maps in `src/types/pose.ts` and `src/lib/constants.ts` rather than hardcoding strings.
- **Path alias:** `@/* → ./src/*` is the only alias configured in `tsconfig.json`.

## License

Released under the [MIT License](./LICENSE).
