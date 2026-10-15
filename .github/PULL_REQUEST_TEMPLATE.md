## Summary

<!-- 說明解決的問題、觸發情境及使用者可觀察到的結果。 -->

## Related issue

<!-- Closes #123；若沒有 issue，請說明背景。 -->

## Type of change

- [ ] Feature
- [ ] Bug fix
- [ ] Refactor / performance
- [ ] Tests / developer workflow
- [ ] Documentation

## Implementation details

<!-- 說明主要設計、相容性與必要取捨，避免逐一列出每個檔案。 -->

- [ ] TypeScript 型別與 Next.js client/server 邊界正確
- [ ] API request/response 與後端契約相容
- [ ] Better Auth session、JWT 與受保護頁面行為已檢查
- [ ] Camera / MediaPipe 啟動、權限、停止與清理行為已檢查
- [ ] 未將原始相機影格、影片或音訊傳送到後端
- [ ] WebSocket 連線、事件、錯誤、斷線與清理行為已檢查
- [ ] ACQUIRING / ACTIVE / PAUSED / LOST 與 tracking hints、form errors 語意保留
- [ ] nullable 身體資料、角度及熱量維持未知語意；數值 0 不等於未知
- [ ] Loading / error / retry / empty states 已檢查
- [ ] 鍵盤操作、標籤、焦點與輔助使用行為已檢查
- [ ] 手機與桌機版面及互動已檢查

<!-- 不適用的項目請註明 N/A 與原因。 -->

## Test evidence

<!-- 填入實際執行指令、結果與環境；未執行需註明原因。 -->

| Check                     | Result / evidence |
| ------------------------- | ----------------- |
| `bun run lint`            |                   |
| `bun run typecheck`       |                   |
| `bun run test`            |                   |
| `bun run test:coverage`   |                   |
| `bun run build`           |                   |
| Relevant Playwright tests |                   |
| `git diff --check`        |                   |
| Manual browser / camera   |                   |

<!-- 區分 API mock、真實本機認證、跨服務整合與真人姿勢驗證。 -->

## Coverage changes

<!-- 行、分支、函式及敘述覆蓋率的前後值；註明來源範圍是否改變。 -->
<!-- 說明新增案例保護的風險，以及尚未驗證的分支。Codecov 初期為資訊性檢查。 -->

## Breaking changes

<!-- None，或列出 API、環境變數、遷移與相容性影響。 -->

## Security and privacy

- [ ] 無憑證、個人資料或未遮罩的敏感紀錄
- [ ] JWT 未放入 URL；伺服器專用設定未使用 NEXT*PUBLIC* 前綴
- [ ] 個人資料權限與 API `/me` 邊界保留
- [ ] 相機影像留在瀏覽器，後端只接收契約允許的關鍵點／狀態

## Reviewer notes

<!-- UI 變更附桌機／手機截圖；涉及相機需另附測試環境與已知限制。 -->
<!-- 指出需特別審查的流程、重現方式或部署前置條件。 -->

## Definition of Done

- [ ] 變更範圍集中，無不相關修改
- [ ] 重要成功、失敗與邊界案例有行為測試，既有測試未被弱化
- [ ] 本機品質檢查通過；不可用的整合環境已揭露
- [ ] 文件、環境設定說明及必要截圖已更新
- [ ] API 契約、tracking／Body Profile 語意未被意外變更
- [ ] 已回應 reviewer 意見；合併前確認遠端 CI 結果
