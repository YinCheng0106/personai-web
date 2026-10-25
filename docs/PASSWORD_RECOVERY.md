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
以公開 `rateLimit.customStorage` 改用 UPSERT，消除內建 read/create 的唯一鍵競態；
storage 的 SQL 錯誤會向外傳遞，不再採用內建吞錯的 best-effort 寫入。
限流儲存使用獨立 pool（預設最多 2 條連線），不占用 credential pool 的可用連線；
credential 回滾仍保留失敗登入／重設的限流計數，避免錯密碼嘗試永遠不累計。
限流 SQL 失敗仍會標記目前 credential operation 失敗，即使上層吞掉錯誤也不提交。
交易連線記錄所有 SQL 拒絕；即使呼叫端吞掉錯誤也拒絕提交，並核對 BEGIN／COMMIT／ROLLBACK
命令結果。COMMIT 回傳 ROLLBACK 或其他結果時不回成功。回滾失敗時銷毀連線。
密碼、token 消耗與 session 撤銷一起提交後才回傳成功。
HTTP handler 與直接 server `auth.api.resetPassword` 都使用此邊界；不得匯出未包裝的 instance。
這個相容層以 1.6.9 的 pg／Kysely driver 行為為依據，升級 Better Auth 時必須重跑並行及回滾測試。

登入同樣由外層交易包住 HTTP 與直接 server `auth.api.signInEmail`。
公開 `emailAndPassword.password.verify` 仍委派 Better Auth 原有 scrypt verifier，
只在該次呼叫的 AsyncLocalStorage 暫存已驗證 hash，不持久化新的 credential／generation。
公開 `databaseHooks.session.create.before` 依 session.userId 取得 credential 列的 `FOR SHARE` 鎖，
在 READ COMMITTED 下重查 hash，與實際驗證的版本比較；不相符回 401，沒有 session／Cookie。
共享鎖保持到 session 提交，與 reset 的 credential UPDATE 資料列鎖互斥：
若 reset 先提交，舊驗證被拒絕；若 session 先提交，reset 才能更新密碼並刪除該 session。
鎖由 PostgreSQL 管理，可跨實例與 OS 程序，無本機 mutex、第二次刪除或全站 credential 鎖。
原 signup、登出、session、JWT/JWKS、callback／登入轉址及 API/PK 授權流程維持原契約。
直接 server API 保留 query.token、asResponse、returnHeaders、returnStatus 等 Better Auth 選項。

成功後撤銷 Better Auth sessions。**已簽發的 FastAPI JWT 最長仍可使用 15 分鐘**；
後端只驗 JWT，沒有即時撤銷清單。既有 WebSocket 也不會因刪除 session 自動斷線，
其身分只在連線時驗證。這保留現有架構；不能宣稱重設會立即使所有 JWT／既有 PK 連線失效。

## 防枚舉、濫用與隱私

- 有效申請對存在、不存在的信箱，以及郵件供應商失敗均回相同一般成功內容。
  郵件透過 Next.js `after` 保留背景工作；HTTP 不等待供應商網路延遲。
  申請回應至少等待 300ms，降低一般資料庫路徑的時間差；不宣稱消除所有時間側通道。
- 在任何額度寫入前先檢查大小、JSON 物件、Better Auth 相同 email 格式、canonical redirect、
  token 格式與密碼長度，再檢查 application/json、明確的可信 Origin 與 Fetch Metadata。
  缺 Origin、cross-site 或錯誤內容型別均拒絕，不消耗全站、來源或信箱額度。
- PostgreSQL 原子 admission：每來源申請 5 次／分鐘、提交 10 次／分鐘，先於全站額度；
  IPv6 合併 /64，mapped IPv4 與 IPv4 共用來源，來源 key 用 server secret HMAC。
  同一來源即使輪換合法格式的信箱／token，也只能占全站額度的一小部分。
  全站申請維持 30 次／分鐘、重設提交 60 次／分鐘；
  每信箱 1 次／分鐘、3 次／小時。信箱以 server secret HMAC 作額度 key；
  查詢帳號前先套用，信箱抑制也先於全站額度；公開回應不透露帳號存在與否。
  另保留 Better Auth 的 request/response 限流作額外保護；該 get/set 介面不提供嚴格 admission，
  復原來源與總額度依賴上述原子 SQL，不能只依賴 library limiter。
  單來源測試不代表抵抗殭屍網路：分散來源仍可能耗盡成本保護總額度，部署層需限制流量、
  監控 429／全站額度與來源數，異常時啟用 challenge/CAPTCHA；不可只提高全站額度。
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
5. 設定 `PERSONAI_TRUSTED_CLIENT_IP_HEADER`，只接受 ingress **覆寫**的單一有效 IP；
   防火牆／私有網路必須禁止繞過 ingress 直接呼叫 app。不能以 client 自報的 X-Forwarded-For、
   X-Real-IP 或 X-PersonAI-Client-IP 建立信任。應用會覆寫內部 header，供 Better Auth 使用。
   生產環境未設定、缺值、無效 IP 或逗號串列都回 503；不退回可偽造 header。
   公開唯讀 GET /api/auth/jwks 例外，維持供 API 讀取公鑰，不要求用戶來源。
   僅非 production 的 loopback 開發網址可在未設定時使用固定 127.0.0.1。
   管理式平台應先確認其單值 header 的覆寫與 origin 存取保證；不可套用新版 Better Auth
   的 trustedProxies 說明到本次固定的 1.6.9。
6. 所有舊實例必須下線後才宣告修復生效；舊版本沒有登入列鎖／交易結果檢查。
   PostgreSQL/PgBouncer 必須支援完整 BEGIN–COMMIT 的同連線交易與 transaction advisory lock。
   上線前在隔離環境重跑多實例測試，確認 5 秒鎖逾時、pool 容量與錯誤監控符合負載；
   每實例預設 credential 5 條加 limiter 2 條，需將兩個 pool 都列入資料庫連線預算。
   盤點並使可能存在的歷史 plaintext verification reset rows 失效；本方案只發行 hashed identifiers，
   不宣稱修復歷史未受支援版本留下的 bearer links。保留既有表即可回復程式，但回退會重開已修漏洞。

自管 Nginx 且直接接受用戶連線的最小範例（前方若有 LB，須先以明確可信 CIDR 設定 real_ip；
不得對全網信任 real_ip）。app 端設定 `PERSONAI_TRUSTED_CLIENT_IP_HEADER=x-personai-ingress-ip`：

```nginx
location /api/auth/ {
    proxy_set_header X-PersonAI-Ingress-IP $remote_addr;
    proxy_set_header X-PersonAI-Client-IP "";
    proxy_set_header X-Forwarded-For "";
    proxy_set_header X-Real-IP "";
    proxy_set_header Host $host;
    proxy_pass http://personai_web;
}
```

在 ingress 加入每來源連線／請求限制及 body 大小限制，以攔截大量 malformed traffic；
應用的無額度驗證不能替代流量防護。此範例與本機測試不構成正式 ingress 已配置的證據。

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
安全回歸另以實際 SQL trigger／controlled promise barriers 驗證同 IP 不同帳號首次 UPSERT、
被吞掉的 SQL 失敗、HTTP 與直接 API 舊 credential 發行競態、獨立 Bun 程序、單連線 pool，
以及 JWT/JWKS 的實際簽章與 reset 後拒發 JWT。斷言包括最後的 token、session、密碼登入結果。
malformed／Origin／Content-Type 拒絕前不扣額度，合法格式濫用隔離及 spoofed forwarding headers
以真實 handler 與 PostgreSQL 測試；可信 ingress header 由 fixture 模擬，不是正式代理驗收。
`auth-database.test.ts` 的非預期 command tag／故障連線案例是 pg mock，
`auth-request.test.ts` 是來源解析單元測試，與 PostgreSQL 整合證據分開。
表單測試包括確認密碼、重複提交與安全錯誤；Resend adapter 測試完全 mock HTTP。
Playwright 復原案例是 mock auth response 的瀏覽器測試，不是實際 Resend 寄送或真實 reset email 點擊。
既有 auth browser 案例使用真實本機認證、mock FastAPI；不把這些結果當成跨服務或真人相機驗收。
