/**
 * 案件管理系統 - 業務邏輯純函式
 * 從 index.html 抽取，供單元測試使用
 */

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
 * 計算指定日期距今天數
 */
export function getDaysDiff(dateStr, now = new Date()) {
  let date = null;
  const dStr = String(dateStr);
  if (dStr.startsWith('Date(')) {
    const parts = dStr.match(/Date\((\d+),(\d+),(\d+)\)/);
    if (parts) {
      date = new Date(parseInt(parts[1]), parseInt(parts[2]), parseInt(parts[3]));
    }
  } else {
    date = new Date(dStr);
  }
  if (date && !isNaN(date.getTime())) {
    const diffTime = Math.abs(now - date);
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }
  return 0;
}

/**
 * 判斷案件是否延遲 (K欄有實質內容)
 */
export function isLate(row) {
  const val = row[9]; // K欄
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
