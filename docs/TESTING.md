# Frontend testing

測試依風險選擇，不依未覆蓋行數排序。覆蓋率只表示程式碼曾被執行，不等於所有行為正確，也不能換算成端對端成功率或真人動作準確率。

## Test layers

| Layer                          | 工具／案例                                | 執行的正式邏輯與限制                                                                                                                      |
| ------------------------------ | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Unit / component               | Vitest、React Testing Library、user-event | 正規化、欄位驗證、UI 與狀態；jsdom 不是完整瀏覽器                                                                                         |
| Mock API                       | MSW `setupServer`                         | 使用正式 `api.ts`、fetch、JWT header、wire mapping 與錯誤轉換；沒有 FastAPI、JWKS 驗證或資料庫授權                                        |
| Controlled WebSocket           | `tests/helpers/socket.ts`                 | 使用正式 socket adapter、hook 與 PK page；替換傳輸邊界並主動派送事件，沒有真實握手、網路延遲或服務端協定驗證                              |
| Mocked browser E2E             | `e2e/frontend-mocked.spec.ts`             | 真正 Chromium、原生表單限制、導覽與桌機／手機 viewport；Better Auth session/token 與 API 都是 route fixture                               |
| Local auth browser integration | `e2e/auth.spec.ts`                        | 真正 Next.js、Better Auth、暫存 PostgreSQL；註冊、登入、登出、JWT 取得。FastAPI REST 與 Analyze WebSocket 仍為 mock，MediaPipe 下載被阻擋 |
| Cross-service integration      | 獨立驗收環境                              | 真正前端、Better Auth / PostgreSQL、FastAPI / JWKS、REST、Analyze / PK WebSocket；目前 CI 沒有啟動 FastAPI                                |
| Real-person pose validation    | 人工與研究驗證                            | 真實相機、MediaPipe、動作與人工 ground truth；不能由上述自動測試推論準確率                                                                |

## Vitest, RTL, and MSW

```bash
bun install --frozen-lockfile
bun run test
bun run test -- tests/socket-events.test.ts tests/pose-analysis.test.tsx
bun run test -- tests/analyze-saving.test.tsx tests/pk-lifecycle.test.tsx
```

`tests/setup.ts` 在每個案例後清理 DOM 與 MSW handlers；未處理的請求視為錯誤。`tests/test-server.ts` 是共用的 MSW server。元件互動優先使用 role／label 與 user-event；不要 mock 掉待驗證的正規化、錯誤處理或核心計數邏輯。

- `api-errors.test.ts`：JWT 失敗不發請求、HTTP 錯誤、非 JSON 錯誤、無效 workout collection、null／0 熱量儲存與網路失敗。
- `socket-events.test.ts`：Analyze／PK 訊息派送、相容欄位、nullable angles、tracking states、無效訊息與生命週期。
- `pose-analysis.test.tsx`：正式 hook 與 socket adapter，控制 SDK 偵測結果、video time 與 RAF；驗證 `pose_missing`、33 點、遞增 frame id、過期回應、reset、清理與 JWT 失敗。
- `analyze-saving.test.tsx`：以 MSW 執行正式 REST client，假時鐘推進訓練；tracking hints 不增加 errorsCount，連續 form error 算同一事件，失敗不顯示儲存成功。
- `pk-lifecycle.test.tsx`：房號、加入／準備／開始／分數、PAUSED 不同步分數、重複分數、離開、重新加入及斷線錯誤。
- `body-profile-page.test.tsx`：unknown／basic／measured、載入／重試、編輯失敗保留輸入與新增量測；既有 null 與 calorie coverage 測試保留。
- `workout-pages.test.tsx`、`auth-forms.test.tsx`、`auth-token.test.ts`、`camera-frame.test.tsx`：dashboard／history、認證失敗與導覽、JWT 取得、相機權限與清理邊界。

API 型別目前不是完整 runtime schema validation。測試覆蓋無效 JSON／collection 拒絕，不能宣稱每個 HTTP 200 payload 欄位都已驗證。Analyze 也未全面拒絕所有形狀不正確的 JSON。若擴充驗證，應另列契約與相容性工作。

## Coverage

```bash
bun run test:coverage
open coverage/index.html
```

沿用 `@vitest/coverage-v8`。`coverage.include` 收集全部 `src/**/*.{ts,tsx}`，包含未被測試載入的 production 原始碼；只排除 `.d.ts`。測試、工具設定、`.next`、報告與產物不在 `src`，不會被收集；未排除 auth、camera、hooks 或其他正式邏輯。

輸出：

- 終端文字報告與 `coverage/index.html`
- **`coverage/lcov.info`**：Codecov coverage upload 的唯一輸入
- `coverage/coverage-summary.json`：本機統計
- `test-results/vitest.xml`：JUnit 測試結果，與 coverage 指標不同

保留門檻：lines、functions、statements 各 60%，branches 50%。失敗時也嘗試產生 coverage；不得降低門檻或排除正式邏輯來修復失敗。

2026-10-15 修改前：12 個檔案、42 個案例通過；舊設定只報告已載入檔案，lines 56.68%、branches 40.47%、functions 57.65%、statements 53.91%，四項門檻均未達標。把**相同原始測試**改用完整 `src` 分母重跑後，分別為 **33.33%、24.29%、35.98%、32.17%**。比較後續變更應採完整分母，勿把收集範圍差異說成測試退步。

2026-10-15 本次完成後：21 個 Vitest 檔案、124 個案例通過；完整 `src` 行覆蓋率 **86.66%（780/900）**、分支 **78.02%（607/778）**、函式 **81.84%（257/314）**、敘述 **86.15%（865/1004）**，原門檻全部通過。Chromium **4/4** 通過（3 個全部使用 mock 邊界，1 個使用真實本機認證與 mock FastAPI）。Playwright 未合併進 V8 coverage；真人姿勢驗證未執行。完整稽核與變更清單見 [TEST_COVERAGE_AUDIT.md](TEST_COVERAGE_AUDIT.md)。

## Playwright

先安裝 Chromium：

```bash
bunx playwright install chromium
# Linux CI 需要作業系統套件：bunx playwright install --with-deps chromium
bun run test:e2e -- e2e/frontend-mocked.spec.ts
```

mocked suite 不需要資料庫，但仍會啟動真正 Next.js dev server。`playwright.config.ts` 設定固定 localhost API／WS，並保留瀏覽器 fake camera flags。所有案例使用瀏覽器事件或可控制時鐘，不以任意 sleep 當同步依據。

執行完整 suite 前，建立**獨立本機測試資料庫**，設定 `DATABASE_URL`、測試用 `BETTER_AUTH_SECRET`，套用 `scripts/bootstrap-auth-schema.sql` 與 `bun run auth:migrate`，再執行：

```bash
bun run test:e2e
```

切勿使用正式資料庫。`auth.spec.ts` 會建立 `.test` 電子郵件帳號；完成後移除暫存測試資料庫。Playwright 的 `webServer` 自動啟動 Next.js；本機會重用既有 3000 port server，因此完整驗證前應確認該 port 為這次的測試服務，避免使用錯誤 env。

輸出 `playwright-report/index.html`、`test-results/playwright.xml`；trace 與其他產物在 `test-results/playwright-artifacts/`，避免清除 Vitest JUnit。CI 失敗可用 `bunx playwright show-report` 檢查本機報告；目前 CI 只保存 XML 與 LCOV artifact，未上傳畫面或 trace。

## Codecov and Test Analytics

CI 在 push 與 pull_request 執行 lint → typecheck → coverage tests → build → Playwright。只跑一次 Vitest，coverage gate 同時包含全部 unit／component tests。

報告先保存為 `frontend-test-reports` artifact（14 天），即使測試失敗也會在有報告時保存。獨立 `codecov` job 使用釘選 SHA 的官方 `codecov/codecov-action` v7，上傳一次 LCOV，另以 **`report_type: test_results`** 上傳可用的 Vitest／Playwright JUnit；停用自動搜尋避免重複上傳。未使用已標示淘汰方向的 `codecov/test-results-action`。

`contents: read` 是預設權限，只有 report job 有 `id-token: write`。同 repo push／PR 使用 OIDC，無需將 upload token 寫入 workflow。fork PR 使用 tokenless 模式，能否接收依 Codecov repository／organization 設定；不改用 `pull_request_target` 或提供 fork secrets。

初期所有 Codecov 上傳都容許外部服務失敗：`fail_ci_if_error: false` 加 step `continue-on-error`；**本機 coverage thresholds 仍強制執行**。`codecov.yml` 的 project target auto、threshold 1%，patch target 80%，兩者 `informational: true`。不要在初期把 Codecov statuses 設為必須通過的 branch protection。

JUnit 可提供案例失敗、耗時及歷次結果，供 Test Analytics 辨識慢測試與 flaky 趨勢。單次通過不能證明沒有 flaky；Playwright 在 CI 的重試也不能當作第一次全部通過。確認平台已接收 Playwright retry 結果與穩定 testcase 身分後，再判讀趨勢。此整合沒有宣稱本機已驗證雲端接收或 flaky 偵測。

Maintainer setup：

1. 在 Codecov 啟用 `YinCheng0106/personai-web`，確認 GitHub App／組織授權及預設分支。
2. 確認 OIDC 與 repository 存取政策、fork tokenless 設定，以及 Test Analytics 的帳號可用性。
3. 經授權推送後，確認 artifact、LCOV 路徑、coverage status 與兩份 JUnit 在遠端接收成功。
4. 累積可靠基準後，再另外決定是否讓 Codecov statuses 成為合併門檻。

官方參考：[Vitest coverage](https://vitest.dev/config/coverage.html)、[Vitest reporters](https://vitest.dev/guide/reporters.html)、[Codecov Action](https://github.com/codecov/codecov-action)、[status checks](https://docs.codecov.com/docs/commit-status)、[Test Analytics](https://docs.codecov.com/docs/test-analytics)。

## Remaining high-risk validation

| Priority | 尚需驗證／限制                                                                                                         |
| -------- | ---------------------------------------------------------------------------------------------------------------------- |
| P0       | 真正 JWT 簽章／過期／issuer／audience／JWKS 與 FastAPI 授權；跨使用者資料隔離；正式 body-profile 與 workout 持久化結果 |
| P0       | 真正相機／MediaPipe／後端 visibility guard 與動作計次；合成 landmarks 不能證明真人準確率、ghost-rep 防護或門檻品質     |
| P1       | 真正雙瀏覽器 PK 握手、房間容量、ready/start/score/disconnect、網路重連與後端協定一致性                                 |
| P1       | 完整 malformed-success-response schema 防護；模型下載失敗、長時間背景執行與不同瀏覽器媒體行為                          |
| P2       | 完整鍵盤／螢幕閱讀器稽核、Safari／Firefox、手機實機旋轉與權限體驗；兩個 Chromium viewport 不是全面響應式保證           |

真實整合需隔離且可重置的 PostgreSQL、啟動中的 FastAPI、相同 issuer／audience／JWKS、正確 CORS／WebSocket Origin、HTTPS／WSS 與不含個資的測試帳號。驗證 REST 拒絕過期或錯誤 JWT、Body Profile 三態及 null／0、儲存後讀回，以及 Analyze 與兩位玩家 PK 全流程。

真人測試需安全的測試空間、同意程序與不外傳影像的紀錄方式；包含無人入鏡、局部遮擋、移出／重入畫面、不同距離／視角與不同體型。依 [tracking contract](Pose_Visibility_Tracking_Contract_v1.md) 檢查 ACQUIRING／ACTIVE／PAUSED／LOST、nullable angles、已完成次數保留與錯誤分類；要報告計次準確率，另需人工標記 ground truth、樣本數與評估方法。
