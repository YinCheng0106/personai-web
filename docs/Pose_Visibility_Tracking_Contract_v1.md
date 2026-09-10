# Pose Visibility & Tracking Contract v1

狀態：已採用（2026-09-09）

本規格是 PersonAI `personai-web` 與 `personai-api` 的即時姿勢分析契約。後端是可見性判定的唯一權威；前端可先顯示提示，但不可自行放行計數。

## 1. 標準相機政策

- 深蹲：使用約 30–45° 正面斜角。肩膀至腳踝需入鏡，人體約占畫面高度 60–80%，可行時四周保留約 10% 空間。
- 伏地挺身：使用約 15–30° 側面斜角。肩、肘、腕、髖與腳踝需保持可見。
- v1 不偵測相機角度，也不分類視角。
- 目前的深蹲膝內扣規則仍是原型，須經真人參與者驗證後才能視為有效。

## 2. 權威處理順序

```text
frame validation
→ visibility guard
→ One-Euro Filter
→ geometry
→ movement FSM
→ repetition
→ posture errors
```

計數依賴不合格的幀不得接觸 One-Euro Filter、動作 FSM、次數、卡路里、PK 分數或姿勢錯誤統計。暫時沒有 WebSocket 訊息只代表傳輸沉默；後端不把它推測為 `pose_missing`。

## 3. 雙側計數與依賴政策

v1 不做單側 fallback。任一計數依賴不合格時，整幀停止分析。

| 運動／規則 | 必要 MediaPipe landmarks |
| --- | --- |
| 深蹲計數 | LEFT_HIP, LEFT_KNEE, LEFT_ANKLE, RIGHT_HIP, RIGHT_KNEE, RIGHT_ANKLE |
| `SQUAT_DEPTH_INSUFFICIENT` | 與深蹲計數相同 |
| `SQUAT_KNEE_VALGUS` | LEFT_HIP, RIGHT_HIP, LEFT_KNEE, RIGHT_KNEE |
| `SQUAT_TORSO_LEAN` | LEFT_SHOULDER, RIGHT_SHOULDER, LEFT_HIP, RIGHT_HIP |
| 伏地挺身計數 | LEFT_SHOULDER, LEFT_ELBOW, LEFT_WRIST, RIGHT_SHOULDER, RIGHT_ELBOW, RIGHT_WRIST |
| `PUSHUP_DEPTH_INSUFFICIENT` | 與伏地挺身計數相同 |
| `PUSHUP_HIP_SAG` | LEFT_SHOULDER, RIGHT_SHOULDER, LEFT_HIP, RIGHT_HIP, LEFT_ANKLE, RIGHT_ANKLE |
| `PUSHUP_HIP_PIKE` | 與 `PUSHUP_HIP_SAG` 相同 |

角度也有各自依賴：膝角使用同側髖／膝／踝，髖角使用同側肩／髖／膝，肘角使用同側肩／肘／腕，身體角使用同側肩／髖／踝。依賴不合格時輸出 `null`，前端顯示 `—`，不得沿用舊角度或補成 `0°`。

權威表實作於 `personai-api/src/personai_api/services/pose_visibility.py`，不得在 handler 或演算法內另寫 landmark 索引判斷。

## 4. 初始可見性政策

以下數值是可集中調整的初始值，尚未經實驗驗證，不得描述為研究結論：

| 情境 | 必要點最低 visibility | 必要點平均 visibility | 連續有效幀 |
| --- | ---: | ---: | ---: |
| 進入／重新取得 ACTIVE | 0.65 | 0.75 | 3 |
| 維持 ACTIVE | 0.50 | 0.65 | 1 |

只有該運動或規則列出的依賴會納入最低值與平均值，不使用全部 33 點的全域門檻。

## 5. Tracking state machine

```text
ACQUIRING --3 consecutive enter-valid frames--> ACTIVE
ACTIVE --invalid or pose_missing--> PAUSED
PAUSED --valid--> ACQUIRING
ACQUIRING/PAUSED --~1 s continuous invalid--> LOST
LOST --valid--> ACQUIRING --3 valid frames--> ACTIVE
```

- `ACQUIRING`：不更新動作；連續三幀通過重新取得門檻後才處理第三幀。
- `ACTIVE`：正常依序執行濾波、幾何、FSM、計數與可執行的姿勢規則。
- `PAUSED`：從 ACTIVE 遇到第一個無效幀時立即進入；凍結濾波、FSM、次數、卡路里、PK 與錯誤輸出。
- `LOST`：連續無效約 1 秒後只執行一次未完成動作與濾波狀態清除；保留已完成次數。
- 短暫中斷後重新進入 ACTIVE 前，會放棄中斷中的未完成週期，避免回到畫面時產生 ghost repetition。
- 完整 workout reset 才會把累積次數歸零。

時間判定使用訊息 timestamp；缺少 timestamp 時才使用後端單調時鐘。沒有收到訊息時不推測姿勢遺失。

## 6. WebSocket `pose_missing` 契約

Landmark 幀（舊客戶端可省略 `kind`）：

```json
{
  "kind": "landmarks",
  "frame_id": 124,
  "timestamp": 10.333,
  "keypoints": [{ "x": 0.5, "y": 0.4, "z": 0.0, "visibility": 0.98 }]
}
```

MediaPipe 已處理影像但找不到姿勢時：

```json
{
  "kind": "pose_missing",
  "frame_id": 125,
  "timestamp": 10.416
}
```

兩種訊息共用嚴格遞增的 `frame_id`、大小限制與速率限制。`pose_missing` 與低品質 landmarks、網路無訊息是三種不同狀況。

## 7. 輸出與提示分類

後端輸出：

- `form_errors`：穩定機器碼，只包含會進入 workout 姿勢錯誤統計的事件。
- `tracking_hints`：定位／追蹤機器碼，例如 `POSE_NOT_FOUND`、`SQUAT_KNEES_NOT_VISIBLE`、`PUSHUP_ARMS_NOT_VISIBLE`、`REACQUIRING_POSE`。
- `tracking_state`：`ACQUIRING`、`ACTIVE`、`PAUSED`、`LOST`。
- `errors`：暫時保留為 `form_errors` 的相容別名；新前端使用 `form_errors`。

前端負責把機器碼翻成繁體中文。`tracking_hints` 不得寫入 workout `errorsCount`，也不得降低 `formScore`。

## 8. 復原語意與已知限制

- 已完成次數跨 PAUSED／LOST 保留；未完成動作在遺失或重新取得時作廢。
- 無效計數幀不更新任何 landmark filter；非計數規則缺少依賴時只停用該規則與相關角度。
- v1 不包含真人 ground-truth study、真人錄影 fixture、單側 fallback、自動視角辨識、velocity/outlier rejection、worldLandmarks、新運動、PK 重設計或合成資料調參。
- PK 仍沿用既有「前端將後端確認的 repetition 同步到 PK 房間」架構；本版只保證無效姿勢分析不會產生新的 repetition／score event，未重設計 PK 防作弊信任邊界。
- 所有 visibility 門檻均為 pilot 前的暫定工程值，完成小型 pilot 後才能評估調整。
