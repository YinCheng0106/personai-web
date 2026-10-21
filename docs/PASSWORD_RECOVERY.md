# 密碼復原安全與部署

## 架構與範圍

Better Auth **1.6.9** 是唯一身分、密碼及重設 token 擁有者。前端使用既有
`authClient.requestPasswordReset`／`resetPassword`，呼叫 Next.js `/api/auth/*`。
FastAPI 不需要忘記密碼 API、使用者密碼欄位或 `password_resets` 表。
登入與重設都使用 `personai_auth.account` 的 `credential` 紀錄與 Better Auth 的雜湊實作。
密碼政策維持 8 至 128 字元；token 有效 15 分鐘，verification identifier 使用內建雜湊儲存。

API [PR #5](https://github.com/YinCheng0106/personai-api/pull/5) 的自訂重設系統已移除，
由本 Web [PR #4](https://github.com/YinCheng0106/personai-web/pull/4) 取代。
兩個分支都整合現有 main；PK、相機、後端確認次數、HUD、伺服器倒數及結果流程保留 main。

## 並行與失敗處理

已安裝 1.6.9 的 `api/routes/password.mjs` 先讀 verification、計算雜湊、更新 credential，
再刪 verification 及 sessions；原生流程不保證並行單次使用。
`auth-database.ts` 用 token SHA-256 衍生的 PostgreSQL transaction advisory lock，
讓所有應用程序對同 token 排隊；AsyncLocalStorage 將 Better Auth 的正式 DB 查詢綁定同一交易。
成功時才 commit；任一步驟出錯皆 rollback。密碼、token 消耗與 session 撤銷因此一起提交。
HTTP handler 與直接 server `auth.api.resetPassword` 都使用此邊界；不得匯出未包裝的 instance。
這個相容層以 1.6.9 的 pg／Kysely driver 行為為依據，升級 Better Auth 時必須重跑並行及回滾測試。

成功後撤銷 Better Auth sessions。**已簽發的 FastAPI JWT 最長仍可使用 15 分鐘**；
後端只驗 JWT，沒有即時撤銷清單。既有 WebSocket 也不會因刪除 session 自動斷線，
其身分只在連線時驗證。這保留現有架構；不能宣稱重設會立即使所有 JWT／既有 PK 連線失效。

## 防枚舉、濫用與隱私

- 有效申請對存在、不存在的信箱，以及郵件供應商失敗均回相同一般成功內容。
  郵件透過 Next.js `after` 保留背景工作；HTTP 不等待供應商網路延遲。
  申請回應至少等待 300ms，降低一般資料庫路徑的時間差；不宣稱消除所有時間側通道。
- PostgreSQL 原子計數：全站申請 30 次／分鐘、重設提交 60 次／分鐘；
  每信箱 1 次／分鐘、3 次／小時。信箱以 server secret HMAC 作額度 key；
  查詢帳號前先套額度，不依賴可偽造的 client IP。
  另保留 Better Auth 的資料庫限流（申請 5 次／分鐘、提交 10 次／分鐘／IP）。
  生產 reverse proxy 必須清除使用者提供的 forwarding headers 並設定可信 IP header。
  全站額度可能被攻擊者耗盡；部署層仍應設流量限制／必要時 CAPTCHA，不應提高額度掩蓋濫用。
- 額度使用 Better Auth 自有 `rateLimit` 表，沒有新增 reset token 副本。
  額度過期後在下一次使用時重設；維運應定期刪除超過保留期的 rateLimit 紀錄，避免長期累積。
- 只接受 `BETTER_AUTH_URL` origin 的精確 `/reset-password` 目的地；callback 本身仍經 Better Auth Origin 檢查。
- 復原頁與 auth routes 使用 `Referrer-Policy: no-referrer`、`Cache-Control: no-store`、noindex。
  頁面載入後將 token 從網址移除，只留元件記憶體；重新整理後需重新開啟信件連結。
- 郵件只含純文字，不放第三方圖片、追蹤像素或分析腳本。Resend dashboard 應停用連結／開信追蹤。
  應用錯誤只記固定訊息，不記錄 token、密碼、email 或 provider response。
  部署時必須遮罩 ingress／proxy／APM 的 auth reset 路徑及 query、Cookie、Authorization、request body；
  初次開啟連結的網址仍可能進入代理或瀏覽器紀錄，前端清除網址不能回溯刪除這些紀錄。

## 部署前置條件

1. 在自己的隔離開發／驗證資料庫先執行 `bun run auth:migrate`。
   此設定會新增 Better Auth `rateLimit` 表；既有 user／account／session／verification schema 不需更動，
   hashed identifier 由 Better Auth 支援。全部 auth routes 都使用資料庫限流，缺表時登入與復原均會 fail closed；須先完成 migration 再部署。
   正式資料庫 migration 須由維護者獨立審核執行，這次未執行。
2. 設定 server-only `RESEND_API_KEY` 與 `RESEND_FROM_EMAIL`。不得用 `NEXT_PUBLIC_*`。
   sender domain 必須在 Resend 完成驗證；不使用 `onboarding@resend.dev`。
   缺設定／供應商失敗只記固定錯誤，公眾仍收到一般成功回應；需監控寄送失敗。
3. `BETTER_AUTH_URL`／`NEXT_PUBLIC_BETTER_AUTH_URL` 指向同一 HTTPS 站台；trusted origins 僅列實際可信來源。
   FastAPI issuer／audience／JWKS 維持相同對應。
4. 不需要新的 Alembic revision，不需套用或補建 API PR 原本的 `PasswordReset` 模型。
   若曾人工部署該自訂表或 endpoint，維護者須另盤點既有資料與憑證暴露，不能假設本次程式修補已清除歷史資料。

## 自動驗證

```bash
# 僅接受本機 loopback、名稱 personai_test、無 query options 的專用測試入口。
# suite 自建 personai_test_reset_<uuid> 資料庫、遷移、測試後刪除；需要 CREATEDB。
PERSONAI_AUTH_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55439/personai_test \
BETTER_AUTH_SECRET=isolated-test-only-secret-at-least-32-characters \
  bun run test
```

未設定 opt-in URL 時會明確 skip 資料庫測試；CI 已設定並會實際執行。
測試使用正式 Better Auth 與 PostgreSQL、mock delivery；包括 token 無效／過期／重用／並行、
舊密碼拒絕／新密碼成功、session 撤銷、撤銷故障回滾、相同公開回應、額度、redirect。
表單測試包括確認密碼、重複提交與安全錯誤；Resend adapter 測試完全 mock HTTP。
Playwright 復原案例是 mock auth response 的瀏覽器測試，不是實際 Resend 寄送或真實 reset email 點擊。
既有 auth browser 案例使用真實本機認證、mock FastAPI；不把這些結果當成跨服務或真人相機驗收。
