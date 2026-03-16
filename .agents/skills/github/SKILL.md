---
name: github
description: 當涉及 git 或 GitHub 操作時自動套用此技能，包括 commit、branch、PR、push、merge、diff、log 等所有版本控制相關操作。
---

# GitHub 操作技能

## 觸發條件

當使用者要求或工作流程涉及以下任一情境時，**必須**套用本技能規則：

- `git commit` / 提交變更
- `git branch` / 建立或切換分支
- `git push` / 推送至遠端
- `git pull` / 拉取更新
- `git merge` / 合併分支
- `git diff` / 查看差異
- `git log` / 查看歷史
- Pull Request (PR) 相關操作
- `.gitignore` 修改
- GitHub Issues 操作
- 任何 `git` CLI 指令

---

## Commit 規則

### 訊息格式

使用 **Conventional Commits** 格式，訊息一律使用**繁體中文**：

```
<類型>(<範圍>): <簡述>

<詳細描述（選填）>
```

### 類型對照表

| 類型       | 用途                     |
| ---------- | ----------------------- |
| `feat`     | 新增功能                 |
| `fix`      | 修復錯誤                 |
| `refactor` | 重構（不影響功能）        |
| `style`    | 樣式調整（不影響邏輯）    |
| `docs`     | 文件更新                 |
| `test`     | 測試相關                 |
| `chore`    | 雜務（建置、設定等）      |
| `perf`     | 效能優化                 |

### 範例

```
feat(登入): 新增 Google OAuth 登入功能
fix(購物車): 修復數量為零時仍可結帳的問題
refactor(API): 將錯誤處理抽取為共用 middleware
docs(README): 補充本地開發環境設定說明
```

---

## Branch 命名規則

```
<類型>/<簡短描述>
```

範例：
- `feat/google-oauth`
- `fix/cart-zero-quantity`
- `refactor/error-middleware`

---

## Git 操作注意事項

1. **commit 前務必確認**：先執行 `git status` 和 `git diff --stat` 檢視變更範圍
2. **不要大包提交**：每個 commit 應對應一個獨立的邏輯變更，必要時拆分多次 commit
3. **敏感資訊保護**：提交前確認 `.gitignore` 已排除密鑰、環境變數、node_modules 等
4. **查看歷史用精簡模式**：`git log --oneline -10`，避免輸出過長
5. **查看差異用統計模式**：`git diff --stat`，需要細節時才用完整 diff

---

## PR 規則

建立 PR 時：
- 標題使用繁體中文，格式同 commit 訊息
- 描述中列出主要變更項目（bullet points）
- 標註相關 Issue（如有）
