/**
 * 案件管理系統 - 業務邏輯純函式
 *
 * 這是「唯一真相來源」(single source of truth)：
 *   - Vitest 透過 ESM import 測試這裡的函式
 *   - index.html 透過 importmap 的 "qa-utils" 別名載入同一份檔案
 * 兩邊共用同一份邏輯，不再各自複製一份（避免測試與執行碼不同步）。
 */

/**
 * 試算表欄位索引對照表。
 * 資料來源 range 預設從 B 欄開始，故 index 0 = B 欄。
 * 各處請改用 COL.XXX 取代魔術數字 row[8] 之類的寫法。
 */
export const COL = {
  TYPE: 0,      // B欄 專案別
  ID: 1,        // C欄 單號
  SEND_DATE: 2, // D欄 送測日
  END_DATE: 3,  // E欄 結束日（有值 = 已結案）
  NAME: 4,      // F欄 任務內容 / 名稱
  WINDOW: 5,    // G欄 窗口
  MORNING: 6,   // H欄 早班
  MIDDLE: 7,    // I欄 中班
  FEEDBACK: 8,  // J欄 狀況反饋
  LATE: 9,      // K欄 遲送狀態
};

/**
 * 解析試算表日期字串為 Date 物件（本地時區午夜）。
 * 支援 Google Sheets gviz 的 Date(y,m,d)（月份 0-based）與 ISO YYYY-MM-DD。
 * ISO 字串一律以「本地午夜」解析，避免 new Date('2025-02-25') 被當成 UTC 造成跨時區 off-by-one。
 * @returns {Date|null}
 */
export function parseRowDate(dateStr) {
  if (dateStr === null || dateStr === undefined) return null;
  const str = String(dateStr);
  let d = null;
  if (str.startsWith('Date(')) {
    const parts = str.match(/Date\((\d+),(\d+),(\d+)\)/);
    if (parts) d = new Date(parseInt(parts[1]), parseInt(parts[2]), parseInt(parts[3]));
  } else {
    const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) d = new Date(parseInt(iso[1]), parseInt(iso[2]) - 1, parseInt(iso[3]));
    else d = new Date(str);
  }
  return (d && !isNaN(d.getTime())) ? d : null;
}

/**
 * 格式化日期字串
 * 支援 Google Sheets 的 Date(y,m,d) 格式與 ISO 字串
 */
export function formatSimpleDate(dateStr) {
  if (!dateStr) return '';
  const str = String(dateStr);
  if (str.startsWith('Date(')) {
    const parts = str.match(/Date\((\d+),(\d+),(\d+)\)/);
    if (parts) return `${parts[1]}/${parseInt(parts[2]) + 1}/${parts[3]}`;
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  return str;
}

/**
 * 取得月份字串 (YYYY-MM)
 */
export function getMonthStr(dateStr) {
  if (!dateStr) return '未知月份';
  const str = String(dateStr);
  let d;
  if (str.startsWith('Date(')) {
    const parts = str.match(/Date\((\d+),(\d+),(\d+)\)/);
    if (parts) d = new Date(parts[1], parts[2], parts[3]);
  } else {
    d = new Date(str);
  }
  return (d && !isNaN(d.getTime())) ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : '未知月份';
}

/**
 * 計算指定日期距今天數（送測累計天數）。
 * 修正：原本用 Math.abs，會把「未來日期」也算成正天數導致累計天數灌水。
 * 現在改為：雙方都正規化到當地午夜再相減，未來日期一律回 0。
 */
export function getDaysDiff(dateStr, now = new Date()) {
  const date = parseRowDate(dateStr);
  if (!date) return 0;
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const b = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((a - b) / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
}

/**
 * 判斷案件是否延遲 (K欄有實質內容)
 */
export function isLate(row) {
  const val = row[COL.LATE]; // K欄
  if (!val) return false;
  const str = String(val).trim();
  const safeWords = ['無', '沒有', '空白', ''];
  return !safeWords.includes(str);
}

/**
 * 判斷反饋是否可統計（排除外包/空白/無）
 */
export function isFeedbackCountable(val) {
  if (!val) return false;
  const str = String(val).trim();
  const excludeList = ['空白', '無', '外包協測', '外包主測', '外包測試'];
  return !excludeList.includes(str);
}

/**
 * 取得合併後的專案名稱
 */
export function getMergedTypeName(originalName, mergeRules = []) {
  if (!originalName) return '未分類';
  const rule = mergeRules.find(r => r.sources.includes(originalName));
  return rule ? rule.targetName : originalName;
}

/**
 * 正規化值：將「空白」「無」「」視為空字串
 */
export function normalize(val) {
  const str = String(val ?? '').trim();
  return ['空白', '無', ''].includes(str) ? '' : str;
}

/**
 * 比對新舊兩份資料，找出「新增」與「狀態異動」的列。
 *
 * 修正 B1：原本的 checkAndNotify 以「陣列索引」逐列比對，試算表只要在中間
 * 插入/刪除/排序一列，索引整批位移，就會把大量既有列誤判成異動而狂發通知。
 * 改以「單號 (COL.ID)」為鍵建立 Map 比對，對插入/刪除/排序免疫。
 *
 * 為純函式（不發送通知、不依賴 React），可被單元測試完整覆蓋。
 *
 * @param {Array[]} oldData 前一次快照
 * @param {Array[]} newData 本次資料
 * @param {number} idIndex 單號所在欄位（預設 COL.ID）
 * @returns {{ added: Array[], changed: Array<{oldRow, newRow, feedbackChanged, lateChanged}> }}
 */
export function diffRows(oldData, newData, idIndex = COL.ID) {
  const added = [];
  const changed = [];
  if (!Array.isArray(oldData) || !Array.isArray(newData)) return { added, changed };

  const keyOf = (row) => String(row?.[idIndex] ?? '').trim();
  const oldMap = new Map();
  oldData.forEach(row => { const k = keyOf(row); if (k) oldMap.set(k, row); });

  newData.forEach(newRow => {
    const k = keyOf(newRow);
    if (!k) return;
    const oldRow = oldMap.get(k);
    if (!oldRow) {
      added.push(newRow);
      return;
    }
    const feedbackChanged = normalize(oldRow[COL.FEEDBACK]) !== normalize(newRow[COL.FEEDBACK]);
    const lateChanged = normalize(oldRow[COL.LATE]) !== normalize(newRow[COL.LATE]);
    if (feedbackChanged || lateChanged) {
      changed.push({ oldRow, newRow, feedbackChanged, lateChanged });
    }
  });

  return { added, changed };
}

/**
 * 第三方 CORS Proxy 策略清單（單一來源）。
 * 原本在 fetchRedmineData / fetchRedmineNote / fetchGanttData 各自複製一份，
 * 現集中於此，新增/移除 proxy 只需改這裡。
 *
 * ⚠️ 安全性提醒：Redmine token 會以 ?key= 經這些第三方公開 proxy 明文轉發，
 *    這是架構層級風險，無法在純前端根除（詳見安全性報告）。
 */
export const PROXY_STRATEGIES = [
  {
    name: 'CodeTabs',
    getUrl: (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  },
  {
    name: 'AllOrigins (JSON)',
    getUrl: (url) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}&_t=${Date.now()}`,
    // AllOrigins 把目標回應包在 { contents: "<原始字串>" } 內
    wrapped: true,
  },
  {
    name: 'CorsProxy.io',
    getUrl: (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  },
];

/**
 * 判斷一段文字是否為 HTML 錯誤頁（Redmine 在未授權/錯誤時常回傳登入頁 HTML）。
 */
export function isHtmlErrorPage(text) {
  if (!text) return false;
  return /^\s*</.test(text) && text.toLowerCase().includes('html');
}

/**
 * 解開 proxy 回傳的內容，取出目標 API 的 JSON。
 * - AllOrigins：實際資料在 json.contents（字串）內，需再 parse 一次
 * - 其他 proxy：直接回傳已 parse 的 json
 * 解析失敗回 null。
 * @param {object} strategy PROXY_STRATEGIES 的其中一項
 * @param {string} text proxy 回傳的原始文字
 */
export function unwrapProxyResponse(strategy, text) {
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    return null;
  }
  if (strategy && strategy.wrapped) {
    if (!json.contents) return null;
    try {
      return JSON.parse(json.contents);
    } catch (e) {
      return null;
    }
  }
  return json;
}

/**
 * 甘特圖時間軸寬度自適應計算（純函式，供單元測試）。
 * 依甘特容器可視寬度，算出左欄寬與每日欄寬：
 *  - leftPanelWidth：containerWidth 的 28%，夾在 [200, 400]
 *  - dayWidth：剩餘寬度平均分給 ganttDays 天（用 floor 確保總寬不超出可視寬，
 *    避免 ResizeObserver 回饋迴圈），再夾在 [minDayWidth, maxDayWidth]
 * 寬螢幕 → 日欄延展填滿；窄螢幕 → 縮到 min 後由呼叫端決定水平捲動。
 * @param {number} containerWidth 甘特捲動容器可視寬（px）
 * @param {number} ganttDays 顯示天數（預設 30）
 * @param {{minDayWidth?:number, maxDayWidth?:number}} opts
 * @returns {{leftPanelWidth:number, dayWidth:number}}
 */
export function computeGanttLayout(containerWidth, ganttDays = 30, opts = {}) {
  const minDayWidth = opts.minDayWidth != null ? opts.minDayWidth : 40;
  const maxDayWidth = opts.maxDayWidth != null ? opts.maxDayWidth : 120;
  const days = ganttDays > 0 ? ganttDays : 1;
  const leftPanelWidth = Math.round(Math.min(400, Math.max(200, containerWidth * 0.28)));
  const avail = containerWidth - leftPanelWidth;
  const dayWidth = Math.max(minDayWidth, Math.min(maxDayWidth, Math.floor(avail / days)));
  return { leftPanelWidth, dayWidth };
}
