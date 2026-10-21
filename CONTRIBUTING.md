# Contributing to PersonAI Web

PersonAI 前端使用 Next.js、TypeScript 與 Bun。開始修改前，先讀取本文件、[測試指南](docs/TESTING.md) 與 [Pose Visibility Tracking Contract](docs/Pose_Visibility_Tracking_Contract_v1.md)。

## Local setup

使用 Bun **1.3.14**，與 CI 一致；`bun.lock` 是依賴版本的依據。Vitest 透過 Node.js 執行，建議使用 Node.js 22.12 以上的受支援 LTS 版本。

```bash
bun --version
bun install --frozen-lockfile
cp .env.sample .env.local
```

將 `.env.local` 設為個人的本機開發設定。不要提交密碼、JWT、Cookie 或正式環境連線字串；不要將伺服器專用設定放入 `NEXT_PUBLIC_*`。

一般前端開發需有本機 PostgreSQL、獨立的開發資料庫與 FastAPI。認證資料表位於 `personai_auth`：

```bash
psql "$DATABASE_URL" -f scripts/bootstrap-auth-schema.sql
bun run auth:migrate
bun run dev
```

`psql` 需由 shell 取得 `DATABASE_URL`；Bun／Next.js 的 env 檔案載入不代表 shell 已匯入變數。只在自己的開發資料庫執行 migration。FastAPI 的 issuer、audience 與 JWKS URL 必須對應 Better Auth；設定範例見 `.env.sample`。Vitest 不需要資料庫、相機或運作中的 API。

## Commands

| Command                           | 用途                                                               |
| --------------------------------- | ------------------------------------------------------------------ |
| `bun run dev`                     | 啟動 Next.js / Turbopack                                           |
| `bun run dev:https`               | 本機 HTTPS 開發與相機測試                                          |
| `bun run lint`                    | ESLint                                                             |
| `bun run typecheck`               | TypeScript 型別檢查                                                |
| `bun run test`                    | Vitest、RTL 與 MSW 測試；產出 JUnit                                |
| `bun run test:coverage`           | V8 coverage 與 JUnit；保留覆蓋率門檻                               |
| `bun run test:e2e`                | Chromium 瀏覽器測試                                                |
| `bun run build` / `bun run start` | 正式建置／執行                                                     |
| `bun run format`                  | 格式化全部 TS／TSX；限定修改可使用 `bunx prettier --write <files>` |
| `git diff --check`                | 檢查空白與衝突標記問題                                             |

## Branches and commits

從團隊指定的基底建立範圍集中的分支，例如 `feat/<topic>`、`fix/<topic>`、`test/<topic>`、`docs/<topic>` 或 `chore/<topic>`。先檢查 `git status`，保留不相關工作；不要在未獲授權時改動其他 checkout、重寫歷史或推送。`codex/` 分支不得推送。

使用 Conventional Commits，英文、祈使句、小寫 type、不加句尾句點：

```text
feat(body-profile): add measurement history
fix(analyze): preserve unavailable calories
test(socket): cover tracking recovery events
docs(testing): explain browser test boundaries
```

其他允許的 type 為 `refactor`、`style`、`chore`、`perf`；scope 能辨識受影響模組時應填寫。不要使用模糊的 `update files`。

## Pull requests and review

先完成實作與驗證，再依 [PR template](.github/PULL_REQUEST_TEMPLATE.md) 整理可供審查的成果。推送或開 PR 前須符合本次工作的授權範圍。連結相關 issue，說明問題、結果、契約影響與取捨；UI 變更附桌機與手機截圖。未執行的檢查要交代原因，不能寫成通過。

Reviewer 應確認成功與失敗流程、型別及 client/server 邊界、API 相容性、認證與隱私、WebSocket 清理、nullable 資料、輔助使用與響應式介面。作者需回應意見並重新執行受影響檢查；合併前查看遠端 CI，不能用本機結果代替遠端證據。

## Test requirements

所有變更執行 lint、typecheck、test、test:coverage、build 與 `git diff --check`。新增或修改重要行為時，加入有意義的成功、失敗與邊界案例。涉及頁面導覽、原生表單限制、版面或瀏覽器 API 時，執行相關 Playwright；涉及真實相機與姿勢品質時另附人工驗證紀錄。

保留既有測試及 coverage thresholds；不得以刪除斷言、排除 production 邏輯或降低門檻換取通過。mock 外部邊界，讓正式 API client、正規化與狀態邏輯接受測試。異步競態使用可控制的 promise／事件，時間流程使用假時鐘，避免任意 sleep。

維持以下契約：

- 相機影像留在瀏覽器；分析只傳送 33 個關鍵點或 `pose_missing`。
- REST 使用 `/me` 與 Bearer JWT；WebSocket 使用 `personai.v1` 與 JWT subprotocol，JWT 不放 URL。
- `tracking_hints` 不算姿勢錯誤事件；保留 ACQUIRING／ACTIVE／PAUSED／LOST 語意。
- Body Profile 的 unknown／basic／measured、缺少角度及熱量使用 `null`；0 是已知數值。
- 演算法、visibility／exercise thresholds、PK protocol 或後端契約的調整須另行明確界定範圍與驗證。
