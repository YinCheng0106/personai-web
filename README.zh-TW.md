# PersonAI

[English](./README.md) | **繁體中文**

> 由 AI 驅動的個人健身夥伴 — 將即時姿勢分析、訓練紀錄與身體組成洞察整合於單一流暢的網頁應用程式中。

PersonAI 是 AI 個人教練的網頁前端。它將即時相機姿勢分析流程與訓練歷程儀表板、身體組成工具結合，讓使用者無需離開瀏覽器，即可獲得關於姿勢、次數與進度的可行性回饋。

## 主要功能

- **即時姿勢分析** — 透過 WebSocket 將相機畫面串流至 Python 後端，並以 HUD 顯示次數計數器、FSM 狀態、關節角度、卡路里估算與即時姿勢錯誤提示。
- **儀表板** — 一目了然的每日指標卡片、週活動圖表、目標進度與當日訓練清單。
- **訓練歷程** — 活動熱力圖、各動作摘要與依時序排列的訓練日誌。
- **InBody 洞察** — BMI 與身體組成卡片，搭配用於規劃訓練的卡路里估算工具。
- **主題切換** — 採用 `next-themes` 與 OKLCH 設計 token，支援淺色／深色模式。
- **驗證準備就緒** — `better-auth` 已配置 PostgreSQL 並啟用 email/password（路由待串接）。
- **在地化 UI** — 所有面向使用者的文案皆使用繁體中文（zh-TW）；後端 enum 會在邊緣透過正規的標籤對照表翻譯。

## 技術堆疊

- **框架：** [Next.js 16](https://nextjs.org/)（App Router、React Server Components、Turbopack）
- **語言：** [TypeScript](https://www.typescriptlang.org/) 5
- **UI：** [React 19](https://react.dev/)、[Tailwind CSS v4](https://tailwindcss.com/)、[shadcn/ui](https://ui.shadcn.com/)（`radix-luma` 風格）、[HugeIcons](https://hugeicons.com/)
- **驗證：** [better-auth](https://www.better-auth.com/) + PostgreSQL（`pg`）
- **相機與姿勢：** [`react-camera-pro`](https://www.npmjs.com/package/react-camera-pro) + 連接 Python 姿勢後端的 WebSocket adapter
- **工具鏈：** [Bun](https://bun.sh/)（套件管理器與執行環境）、ESLint（flat config）、搭配 `prettier-plugin-tailwindcss` 的 Prettier

## 開始使用

### 前置需求

- [Bun](https://bun.sh/) ≥ 1.0（npm/pnpm/yarn 亦可運作，但 `bun.lock` 是唯一可信來源）
- Node.js ≥ 20（僅在不使用 Bun 時需要）
- 執行中的 [PersonAI backend](https://github.com/YinCheng0106/personai-api) 提供即時姿勢分析與 REST 資料（選用 — 此應用程式內附 mock 資料）
- PostgreSQL（僅在串接 `better-auth` 時需要）

### 安裝

```bash
# Clone
git clone https://github.com/YinCheng0106/personai-web.git
cd personai-web

# Install dependencies
bun install
# or: npm install / pnpm install / yarn
```

### 環境變數

將 `.env.sample` 複製為 `.env.local` 並填入對應值：

```bash
cp .env.sample .env.local
```

| 變數                    | 說明                                                                        | 預設值                   |
| ----------------------- | --------------------------------------------------------------------------- | ------------------------ |
| `NEXT_PUBLIC_API_BASE`  | PersonAI backend 的 REST base URL。                                         | `http://localhost:8000`  |
| `NEXT_PUBLIC_WS_BASE`   | `connectAnalyzeSocket` 用於即時姿勢串流的 WebSocket base URL。              | `ws://localhost:8000`    |
| `DATABASE_URL`          | `better-auth` 使用的 PostgreSQL 連線字串。                                  | —                        |
| `BETTER_AUTH_SECRET`    | 用來簽署驗證 token 的 secret（以 `openssl rand -base64 32` 產生）。         | —                        |
| `BETTER_AUTH_URL`       | 此應用程式的對外 base URL（例如 `http://localhost:3000`）。                 | —                        |

### 可用的 Scripts

| 指令                 | 說明                                                     |
| -------------------- | -------------------------------------------------------- |
| `bun dev`            | 以 Turbopack 啟動 Next.js 開發伺服器。                   |
| `bun run build`      | 建立 production build。                                  |
| `bun start`          | 提供 production build 服務。                             |
| `bun run lint`       | 執行 ESLint（flat config、`eslint-config-next`）。       |
| `bun run typecheck`  | 以 `tsc --noEmit` 進行型別檢查。                         |
| `bun run format`     | 以 Prettier 格式化 `**/*.{ts,tsx}`。                     |

開發伺服器啟動後，請開啟 [http://localhost:3000](http://localhost:3000)。

### 加入 shadcn/ui 元件

```bash
bunx shadcn@latest add <component>
```

元件會以 `radix-luma` 風格搭配 `neutral` base color 與 HugeIcons，加入到 `src/components/ui/`。

### 從 Mock 切換到 Live 資料

- **姿勢串流：** 在 `src/app/analyze/page.tsx` 中，將 `useMockPose` 替換為呼叫 `src/lib/socket.ts` 內 `connectAnalyzeSocket(...)` 的 `useEffect`。`PoseData` 結構完全相同 — 所有 snake/camel 的轉換都集中在 `normalizeFrame()` 中。
- **REST 資料：** 將 `src/lib/mock-data.ts` 中的 `MOCK_*` import 換成 `src/lib/api.ts` 中對應的 helper。回應型別（`WorkoutRecord`、`DailySummary`、`ExerciseSummary`、`InBody`）一一對應。

## 專案結構

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

## 慣例

- **格式化：** 不使用分號、使用雙引號、2 空格縮排、`trailingComma: es5`、80 欄寬。Tailwind class 排序由 `prettier-plugin-tailwindcss` 強制執行 — 請在 commit UI 變更前執行 `bun run format`。
- **樣式：** 引用語意化 token（`bg-background`、`text-muted-foreground`、`border-border`、`text-success`、`text-warning`、`text-info`），如此深色模式才會自動運作。
- **在地化：** UI 文案為 zh-TW。後端 enum 請透過 `src/types/pose.ts` 與 `src/lib/constants.ts` 中的標籤對照表翻譯，而非硬編碼字串。
- **Path alias：** `tsconfig.json` 僅配置 `@/* → ./src/*` 一個別名。

## 授權

以 [MIT License](./LICENSE) 釋出。
