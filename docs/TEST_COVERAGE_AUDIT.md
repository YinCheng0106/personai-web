# Frontend test and developer workflow audit

日期：2026-10-15（Asia/Taipei）。Repository：`YinCheng0106/personai-web`。

## Scope and preservation

開始時 primary checkout 在 `main`，工作目錄乾淨。依指定目標建立並切換至 `chore/test-coverage-and-dev-workflow`；HEAD 維持 `5bd97ff9f24346f01ad3ef6d11d1da3a251c4603`，沒有 commit、push、merge、rebase、amend 或 PR 操作，也沒有建立 worktree。

已檢查 package.json、bun.lock、Vitest／Playwright、唯一現有 CI workflow、既有 12 個測試檔、MSW setup、API client、Analyze／PK socket、pose hook、相關頁面、Body Profile 型別、tracking contract、README 與 CLAUDE.md。原本沒有要求新增的 PR／issue templates、CONTRIBUTING.md、TESTING.md 或 codecov.yml。本機 backend checkout 的 `.github/` 只有 CI workflow，沒有可直接複用的 PR template；新範本採本次要求的 11 個章節。

本次沒有修改 `src/`、package.json、bun.lock 或 `docs/Pose_Visibility_Tracking_Contract_v1.md`。無新增依賴、演算法／門檻／PK protocol／Body Profile API／認證架構變更。

## Coverage baseline and result

| Metric     | 修改前：原有載入範圍 | 修改前：完整 src 範圍 | 完成後：完整 src 範圍 | 原門檻 |
| ---------- | -------------------: | --------------------: | --------------------: | -----: |
| Lines      |               56.68% |      33.33% (300/900) |      86.66% (780/900) |    60% |
| Branches   |               40.47% |      24.29% (189/778) |      78.02% (607/778) |    50% |
| Functions  |               57.65% |      35.98% (113/314) |      81.84% (257/314) |    60% |
| Statements |               53.91% |     32.17% (323/1004) |     86.15% (865/1004) |    60% |

兩次修改前基準都使用原有 42 個測試。舊設定預設只收集測試載入檔案，不能與完整 src 分母混為一談。完成後的 LCOV 包含 57 個 src 檔案，包含未由 Vitest 執行的 server auth；只排除 `.d.ts`。保留 V8、文字與 HTML，新增 LCOV、JSON summary 與失敗時報告。

## Risk-driven test additions

新增 **82 個 Vitest 案例**，由 12 檔／42 案例成為 **21 檔／124 案例**；保留全部既有案例。新增九個測試檔與共用 fixtures／transport helper。

- P0 JWT：token 缺少／空值／錯誤、失效時不發 API／WS 請求、REST bearer 與 WS subprotocol，登入／註冊失敗與安全 redirect。
- P0 Analyze：snake_case、legacy 欄位、四種 tracking states、null／0 angles 與 calories、form errors 優先序、`pose_missing`、33 點、幀順序、重複回應、reset、清理與 late JWT。
- P0 Workout：使用正式 API client 的儲存 wire payload、null／0 calories、追蹤提示不算姿勢錯誤、錯誤事件 episode 計數、儲存中禁止重複送出、儲存失敗恢復。
- P0 Body Profile：保留 unknown／basic／measured 既有案例，補上載入重試、清空欄位、失敗保留輸入、重試儲存、Unknown 新增量測、取消與 loading lock。
- P1 PK：建立／加入、輸入限制、等待第二人、ready／cancel、start、只同步 ACTIVE 已確認 reps、連續 score、對手分數、斷線／重加入／離開及過期事件。
- P1 API／頁面：HTTP 401／403／404／409／422／429／5xx、非 JSON error、malformed workout collection、網路失敗、dashboard／history loading／empty／error 與 nullable calorie coverage。
- P1/P2 Camera／browser：相機權限被拒、無裝置、裝置占用、Permissions API 不支援、probe track stop；真正 Chromium 的表單 range validation、焦點、導覽與 1280px／390px viewport。

測試只替換外部邊界。API failure／wire tests 與 workout pages 使用既有 MSW；socket／hook／PK page 執行正式 adapter，以可控制的 transport 代替真實 WebSocket；MediaPipe SDK 與相機硬體被替換。訓練時間以假時鐘推進；既有 E2E 的固定 1500ms sleep 已改為 browser clock。

## Codecov and Test Analytics

`coverage/lcov.info` 已產生且可讀；只收集 src。CI 以 coverage invocation 取代重複的 plain Vitest invocation，保留 lint、typecheck、build、PostgreSQL／Better Auth migration 與 Playwright。

官方 `codecov/codecov-action` v7 釘選 `f9fe539f5290016afa014f8ef31597d3a61c2dea`。獨立 report job 讀取 quality artifact，不執行專案程式碼；只有這個 job 取得 `id-token: write`，預設 `contents: read`。同 repo push／pull_request 使用 OIDC；fork PR 使用 tokenless，是否接受依外部設定。

只有一次 coverage upload，明確指定 LCOV、停用搜尋；另一次 `report_type: test_results` 上傳存在的 Vitest／Playwright JUnit，沒有使用舊 Test Results Action。上傳容許外部失敗，coverage 本機門檻依然有效。Project target auto、threshold 1%；patch target 80%；兩者 informational。

已解析 JUnit：Vitest 124 testcase、Playwright 4 testcase，兩份皆有每案例 time 且沒有 failure。測試開發期間的失敗亦曾寫入 JUnit。平台可用歷次失敗／耗時判讀 flaky，但本次沒有上傳，也未驗證雲端接收、重試解析、flaky 偵測或帳號方案可用性。

## Quality gates and environment

| Gate                               | 結果                                                                                                  |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `bun run lint`                     | PASS；排除 generated report artifacts 後無 lint 警告                                                  |
| `bun run typecheck`                | PASS                                                                                                  |
| `bun run test`                     | PASS：21 檔、124/124                                                                                  |
| `bun run test:coverage`            | PASS：124/124，四項原門檻全部通過                                                                     |
| `bun run build`                    | PASS：Next.js production build、TypeScript 與靜態頁生成成功                                           |
| `bun run test:e2e`                 | PASS：Chromium 4/4，無重試；本機 retries=0                                                            |
| `git diff --check`                 | PASS                                                                                                  |
| Workflow／Codecov／issue form YAML | Ruby YAML parser 通過；不等同遠端 Actions 或 Codecov schema 驗收                                      |
| Protected source／lockfile diff    | `git diff --exit-code -- src package.json bun.lock docs/Pose_Visibility_Tracking_Contract_v1.md` 通過 |

本機 macOS、Bun 1.4.3、Node.js v26.5.0、PostgreSQL 17.11；CI 保留 Bun 1.3.14，遠端尚未執行。本機 PostgreSQL 使用獨立暫存 cluster 與 loopback port，全部認證測試使用合成 `.test` 帳號，沒有使用遠端 Supabase、FastAPI 或個人憑證。建置時使用本機測試 auth 設定。測試結束後已停止並移除本次建立的暫存 PostgreSQL cluster。

執行工具仍有 Node.js localStorage／module.register 及 Playwright color 環境提示；這些不是被忽略的測試失敗。既有 camera mock 的 forwardRef signature 提示未影響既有測試結果。

## Integration limits and next steps

**4/4（100%）只是本次 Chromium 案例通過率**。其中 3 個完全 mock 認證與 API，1 個執行真實本機 Better Auth／PostgreSQL，但 FastAPI REST／Analyze socket 仍被 mock，模型下載被阻擋。這不是跨服務整合成功率，也不是計次或姿勢準確率。Playwright 結果沒有合併進 Vitest coverage。

尚未提供／啟動真實 FastAPI／JWKS／雙玩家 PK 的整合環境。未執行真人相機驗證、實機 Safari／Firefox、螢幕閱讀器或 ground-truth 評估。原有 visibility 門檻與 pose tracking 演算法原封不動。

後續優先順序：

1. Maintainer 在 Codecov 啟用 repository、GitHub App／OIDC、必要的 fork tokenless 與 Test Analytics 權限；經授權推送後核對報告接收與 informational statuses。本次未推送、未設定帳號。
2. 建立隔離的真實前後端環境，驗證 JWT 簽章／失效／JWKS、跨使用者權限、Body Profile 三態、儲存讀回及雙瀏覽器 PK。
3. 針對 malformed HTTP 200 欄位與 Analyze JSON 增加另案 runtime validation；目前 TypeScript cast 不能保證線上 payload 完整有效。
4. 真實 MediaPipe／相機驗證 tracking states、失去／重新取得姿勢與已完成次數；若要報告準確率，先規劃 ground truth、樣本與方法。
5. 累積穩定 CI／Codecov 基準後再評估 required status；補 Safari／Firefox、鍵盤／螢幕閱讀器與手機實機測試。

完整操作方式與整合前置條件見 [TESTING.md](TESTING.md)；開發、Conventional Commits 與審查規則見 [CONTRIBUTING.md](../CONTRIBUTING.md)。

## Changed files

- [.github/ISSUE_TEMPLATE/bug_report.yml](../.github/ISSUE_TEMPLATE/bug_report.yml)
- [.github/ISSUE_TEMPLATE/feature_request.yml](../.github/ISSUE_TEMPLATE/feature_request.yml)
- [.github/PULL_REQUEST_TEMPLATE.md](../.github/PULL_REQUEST_TEMPLATE.md)
- [.github/workflows/ci.yml](../.github/workflows/ci.yml)
- [.gitignore](../.gitignore)
- [CLAUDE.md](../CLAUDE.md)
- [CONTRIBUTING.md](../CONTRIBUTING.md)
- [README.md](../README.md)
- [README.zh-TW.md](../README.zh-TW.md)
- [codecov.yml](../codecov.yml)
- [docs/TESTING.md](../docs/TESTING.md)
- [docs/TEST_COVERAGE_AUDIT.md](../docs/TEST_COVERAGE_AUDIT.md)
- [e2e/auth.spec.ts](../e2e/auth.spec.ts)
- [e2e/frontend-mocked.spec.ts](../e2e/frontend-mocked.spec.ts)
- [eslint.config.mjs](../eslint.config.mjs)
- [playwright.config.ts](../playwright.config.ts)
- [tests/analyze-saving.test.tsx](../tests/analyze-saving.test.tsx)
- [tests/api-errors.test.ts](../tests/api-errors.test.ts)
- [tests/auth-forms.test.tsx](../tests/auth-forms.test.tsx)
- [tests/auth-token.test.ts](../tests/auth-token.test.ts)
- [tests/body-profile-page.test.tsx](../tests/body-profile-page.test.tsx)
- [tests/camera-frame.test.tsx](../tests/camera-frame.test.tsx)
- [tests/helpers/fixtures.ts](../tests/helpers/fixtures.ts)
- [tests/helpers/socket.ts](../tests/helpers/socket.ts)
- [tests/pk-lifecycle.test.tsx](../tests/pk-lifecycle.test.tsx)
- [tests/pose-analysis.test.tsx](../tests/pose-analysis.test.tsx)
- [tests/pose-messages.test.ts](../tests/pose-messages.test.ts)
- [tests/require-auth.test.tsx](../tests/require-auth.test.tsx)
- [tests/socket-events.test.ts](../tests/socket-events.test.ts)
- [tests/workout-pages.test.tsx](../tests/workout-pages.test.tsx)
- [vitest.config.ts](../vitest.config.ts)
