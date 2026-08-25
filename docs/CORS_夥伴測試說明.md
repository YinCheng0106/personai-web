# PersonAI 前端總覽頁 `failed to fetch` 測試說明

請在**正在發生問題的那台電腦**上完成以下測試，並把結果回傳給開發者。這個測試不會修改資料或帳號。

## 1. 確認 API 是否正確回應 CORS 預檢

請先確認 PersonAI API 正在 `http://localhost:8000` 執行，接著依作業系統擇一執行。

### Windows PowerShell

```powershell
curl.exe -i -X OPTIONS http://localhost:8000/wk/me -H "Origin: http://localhost:3000" -H "Access-Control-Request-Method: GET" -H "Access-Control-Request-Headers: authorization,content-type"
```

### macOS／Linux Terminal

```bash
curl -i -X OPTIONS http://localhost:8000/wk/me \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization,content-type"
```

## 2. 預期結果

正常時應該看到：

```text
HTTP/... 200 OK
access-control-allow-origin: http://localhost:3000
access-control-allow-methods: GET, POST, OPTIONS
```

如果看到 `405 Method Not Allowed`、沒有 `access-control-allow-origin`，或無法連線，請不要自行調整 CORS 設定，直接回傳完整輸出。

## 3. 如果結果是 `405`，再做以下檢查（Windows PowerShell）

請在 `personai-api` 專案根目錄執行：

```powershell
Select-String -Path .\src\personai_api\main.py -Pattern "CORSMiddleware","app.add_middleware"
git log -1 --oneline
git status --short
Get-NetTCPConnection -LocalPort 8000 -State Listen | Select-Object LocalAddress,LocalPort,OwningProcess
```

接著請關閉原本啟動 API 的終端機，確認 8000 的行程已停止後，從這個專案根目錄重新啟動：

```powershell
hatch run fastapi dev .\src\personai_api\main.py
```

啟動完成後，再重跑第 1 節的 `curl.exe` 指令。

> `405` 並且回應標頭為 `allow: GET`，代表預檢請求直接進入了 `GET /wk/me` 路由；正常的 CORS middleware 應在這之前回應它。

## 4. 請回傳以下資訊

1. 上述 `curl` 指令的**完整輸出**。
2. API 的啟動指令，例如 `hatch run fastapi dev src/personai_api/main.py`。
3. 執行測試時 API 終端機新增的完整日誌行。
4. 瀏覽器按 `F12` → **Network** → 點選失敗的 `OPTIONS /wk/me` 後，以下欄位的截圖或文字：
   - Status Code
   - Request URL
   - Request Headers 裡的 `Origin`
   - Response Headers 裡所有 `access-control-*` 與 `allow` 欄位
5. 作業系統與瀏覽器版本，例如「Windows 11、Chrome 139」。
6. 若第 1 節結果為 405：第 3 節四個指令的完整輸出，以及重新啟動後的 API 終端機日誌。

## 注意事項

- 不要回傳 `Authorization: Bearer ...` 的完整內容、Cookie、密碼或 `.env` 檔案；若截圖包含它們，請先遮蔽。
- 瀏覽器的總覽頁請保持開在 `http://localhost:3000`，API 請保持在 `http://localhost:8000`。
- 此測試只發送 `OPTIONS` 預檢請求，不會新增、修改或刪除任何運動資料。
