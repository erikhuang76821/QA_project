# QA_project

QA 案件管理系統 — 純前端 React SPA（單一 `index.html` + CDN，無建置流程）。
詳細功能與架構見 [`structure.md`](./structure.md)。

線上版（GitHub Pages）：<https://erikhuang76821.github.io/QA_project/>

## 開發 / 測試

業務邏輯純函式集中在 `src/utils.js`（單一真相來源，`index.html` 透過 importmap 的
`qa-utils` 別名載入同一份），以 Vitest 測試：

```bash
npm install
npm test          # 執行單元測試
npm run test:watch
```

> 本機預覽需以 HTTP 提供（importmap + ES module 不支援 file://），
> 例如 `npx serve .` 後開啟對應網址。

## 甘特圖：唯讀模式

「案件排程」甘特圖預設為**唯讀看板**。原因：純前端透過公開 CORS proxy 可讀（GET）不可寫
（PUT 不被轉發），拖曳調整排程的「確認更新」無法可靠寫回 Redmine，且有「假成功」風險。
如需調整排程請直接到 Redmine 操作。

由 `index.html` 頂部的開關控制：

```js
const GANTT_EDITABLE = false;   // false = 唯讀；true = 恢復拖曳調整 + 確認寫入
```

拖曳/寫入相關邏輯（`handleMouseDown` / `updateIssueDates` / `confirmUpdate` /
`ganttPendingUpdate`）皆保留，僅由此開關決定是否啟用。**僅在部署了可轉發 PUT 並以
header 帶 token 的自控 proxy（例如 Cloudflare Worker，並同步更新 `updateIssueDates`
的目標）後，再將開關設為 `true`。**
