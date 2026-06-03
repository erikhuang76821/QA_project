import { describe, it, expect } from 'vitest';
import {
    COL,
    formatSimpleDate,
    getMonthStr,
    getDaysDiff,
    isLate,
    isFeedbackCountable,
    getMergedTypeName,
    normalize,
    diffRows,
    PROXY_STRATEGIES,
    isHtmlErrorPage,
    unwrapProxyResponse,
    computeGanttLayout,
} from './utils.js';

// 建立一列測試資料：可指定單號(id)、反饋(J)、遲送(K)
const makeRowFull = ({ id = '', type = 'P', name = 'task', feedback = '', late = '' } = {}) => {
    const row = new Array(10).fill('');
    row[COL.TYPE] = type;
    row[COL.ID] = id;
    row[COL.NAME] = name;
    row[COL.FEEDBACK] = feedback;
    row[COL.LATE] = late;
    return row;
};

// ============================================================
// formatSimpleDate
// ============================================================
describe('formatSimpleDate', () => {
    it('應解析 Google Sheets Date(y,m,d) 格式（月份 +1）', () => {
        expect(formatSimpleDate('Date(2024,0,15)')).toBe('2024/1/15');
        expect(formatSimpleDate('Date(2024,11,31)')).toBe('2024/12/31');
    });

    it('應解析 ISO 日期字串', () => {
        const result = formatSimpleDate('2024-06-15');
        expect(result).toMatch(/2024\/6\/15/);
    });

    it('null / undefined / 空字串 → 空字串', () => {
        expect(formatSimpleDate(null)).toBe('');
        expect(formatSimpleDate(undefined)).toBe('');
        expect(formatSimpleDate('')).toBe('');
    });

    it('無法解析的字串 → 原樣回傳', () => {
        expect(formatSimpleDate('not-a-date')).toBe('not-a-date');
    });
});

// ============================================================
// getMonthStr
// ============================================================
describe('getMonthStr', () => {
    it('Date(2024,0,15) → 2024-01', () => {
        expect(getMonthStr('Date(2024,0,15)')).toBe('2024-01');
    });

    it('Date(2024,11,1) → 2024-12', () => {
        expect(getMonthStr('Date(2024,11,1)')).toBe('2024-12');
    });

    it('ISO 字串 2024-06-15 → 2024-06', () => {
        expect(getMonthStr('2024-06-15')).toBe('2024-06');
    });

    it('null / 空 → 未知月份', () => {
        expect(getMonthStr(null)).toBe('未知月份');
        expect(getMonthStr('')).toBe('未知月份');
    });

    it('無效字串 → 未知月份', () => {
        expect(getMonthStr('garbage')).toBe('未知月份');
    });
});

// ============================================================
// getDaysDiff
// ============================================================
describe('getDaysDiff', () => {
    const fixedNow = new Date(2025, 1, 25); // 2025-02-25

    it('同一天 → 0', () => {
        expect(getDaysDiff('2025-02-25', fixedNow)).toBe(0);
    });

    it('10 天前 → 10', () => {
        // 用 Date(y,m,d) 格式避免 ISO 字串的時區偏移
        expect(getDaysDiff('Date(2025,1,15)', fixedNow)).toBe(10);
    });

    it('Date(2025,1,20) → 5', () => {
        expect(getDaysDiff('Date(2025,1,20)', fixedNow)).toBe(5);
    });

    it('無效日期 → 0', () => {
        expect(getDaysDiff('invalid', fixedNow)).toBe(0);
    });

    it('null → 0', () => {
        expect(getDaysDiff(null, fixedNow)).toBe(0);
    });
});

// ============================================================
// isLate
// ============================================================
describe('isLate', () => {
    const makeRow = (kVal) => {
        const row = new Array(10).fill('');
        row[9] = kVal;
        return row;
    };

    it('K欄有實質內容 → true', () => {
        expect(isLate(makeRow('延遲3天'))).toBe(true);
        expect(isLate(makeRow('客戶未回覆'))).toBe(true);
    });

    it('K欄為安全詞 → false', () => {
        expect(isLate(makeRow('無'))).toBe(false);
        expect(isLate(makeRow('沒有'))).toBe(false);
        expect(isLate(makeRow('空白'))).toBe(false);
        expect(isLate(makeRow(''))).toBe(false);
    });

    it('K欄為 null / undefined → false', () => {
        expect(isLate(makeRow(null))).toBe(false);
        expect(isLate(makeRow(undefined))).toBe(false);
    });
});

// ============================================================
// isFeedbackCountable
// ============================================================
describe('isFeedbackCountable', () => {
    it('有效反饋 → true', () => {
        expect(isFeedbackCountable('Bug 修復中')).toBe(true);
        expect(isFeedbackCountable('已完成')).toBe(true);
    });

    it('排除清單中的值 → false', () => {
        expect(isFeedbackCountable('空白')).toBe(false);
        expect(isFeedbackCountable('無')).toBe(false);
        expect(isFeedbackCountable('外包協測')).toBe(false);
        expect(isFeedbackCountable('外包主測')).toBe(false);
        expect(isFeedbackCountable('外包測試')).toBe(false);
    });

    it('null / undefined / 空字串 → false', () => {
        expect(isFeedbackCountable(null)).toBe(false);
        expect(isFeedbackCountable(undefined)).toBe(false);
        expect(isFeedbackCountable('')).toBe(false);
    });
});

// ============================================================
// getMergedTypeName
// ============================================================
describe('getMergedTypeName', () => {
    const rules = [
        { id: 1, targetName: '老虎機合併', sources: ['老虎機A', '老虎機B'] },
        { id: 2, targetName: '捕魚合併', sources: ['捕魚1'] },
    ];

    it('匹配規則 → 合併名稱', () => {
        expect(getMergedTypeName('老虎機A', rules)).toBe('老虎機合併');
        expect(getMergedTypeName('老虎機B', rules)).toBe('老虎機合併');
        expect(getMergedTypeName('捕魚1', rules)).toBe('捕魚合併');
    });

    it('無匹配規則 → 原名', () => {
        expect(getMergedTypeName('其他專案', rules)).toBe('其他專案');
    });

    it('null → 未分類', () => {
        expect(getMergedTypeName(null, rules)).toBe('未分類');
        expect(getMergedTypeName(undefined, rules)).toBe('未分類');
    });

    it('無規則 → 原名', () => {
        expect(getMergedTypeName('老虎機A')).toBe('老虎機A');
        expect(getMergedTypeName('老虎機A', [])).toBe('老虎機A');
    });
});

// ============================================================
// normalize
// ============================================================
describe('normalize', () => {
    it('空白/無/空字串 → 空字串', () => {
        expect(normalize('空白')).toBe('');
        expect(normalize('無')).toBe('');
        expect(normalize('')).toBe('');
    });

    it('前後空白也應正規化', () => {
        expect(normalize('  空白  ')).toBe('');
        expect(normalize('  無  ')).toBe('');
    });

    it('有值 → 原值 (trimmed)', () => {
        expect(normalize('延遲')).toBe('延遲');
        expect(normalize('  Bug  ')).toBe('Bug');
    });

    it('null / undefined → 空字串', () => {
        expect(normalize(null)).toBe('');
        expect(normalize(undefined)).toBe('');
    });

    it('數字轉字串後保留', () => {
        expect(normalize(123)).toBe('123');
    });

    it('數字 0 應保留為有效值', () => {
        expect(normalize(0)).toBe('0');
    });
});

// ============================================================
// getDaysDiff - 修正 B3：未來日期不應算成正天數
// ============================================================
describe('getDaysDiff - 未來日期 (修正 B3)', () => {
    const fixedNow = new Date(2025, 1, 25); // 2025-02-25

    it('未來日期 → 0（不再用 Math.abs 算成正天數）', () => {
        expect(getDaysDiff('Date(2025,1,28)', fixedNow)).toBe(0); // 3 天後
        expect(getDaysDiff('Date(2025,2,10)', fixedNow)).toBe(0); // 下個月
    });

    it('當天不同時分仍為 0（已正規化到午夜）', () => {
        const noonNow = new Date(2025, 1, 25, 18, 30);
        expect(getDaysDiff('Date(2025,1,25)', noonNow)).toBe(0);
    });

    it('ISO 字串以本地午夜解析，跨時區不會 off-by-one', () => {
        expect(getDaysDiff('2025-02-15', fixedNow)).toBe(10);
    });
});

// ============================================================
// diffRows - 修正 B1：以單號為鍵比對，免疫插入/刪除/排序
// ============================================================
describe('diffRows', () => {
    it('新單號 → added', () => {
        const oldData = [makeRowFull({ id: 'A1' })];
        const newData = [makeRowFull({ id: 'A1' }), makeRowFull({ id: 'A2' })];
        const { added, changed } = diffRows(oldData, newData);
        expect(added).toHaveLength(1);
        expect(added[0][COL.ID]).toBe('A2');
        expect(changed).toHaveLength(0);
    });

    it('反饋(J欄)改變 → changed.feedbackChanged', () => {
        const oldData = [makeRowFull({ id: 'A1', feedback: '無' })];
        const newData = [makeRowFull({ id: 'A1', feedback: 'Bug 修復中' })];
        const { added, changed } = diffRows(oldData, newData);
        expect(added).toHaveLength(0);
        expect(changed).toHaveLength(1);
        expect(changed[0].feedbackChanged).toBe(true);
        expect(changed[0].lateChanged).toBe(false);
    });

    it('遲送(K欄)改變 → changed.lateChanged', () => {
        const oldData = [makeRowFull({ id: 'A1', late: '' })];
        const newData = [makeRowFull({ id: 'A1', late: '延遲3天' })];
        const { changed } = diffRows(oldData, newData);
        expect(changed).toHaveLength(1);
        expect(changed[0].lateChanged).toBe(true);
    });

    it('「空白/無/空字串」視為相同 → 不算異動', () => {
        const oldData = [makeRowFull({ id: 'A1', feedback: '空白', late: '無' })];
        const newData = [makeRowFull({ id: 'A1', feedback: '無', late: '' })];
        const { added, changed } = diffRows(oldData, newData);
        expect(added).toHaveLength(0);
        expect(changed).toHaveLength(0);
    });

    it('在中間插入一列 → 只報新增，既有列不誤報（B1 核心情境）', () => {
        const oldData = [
            makeRowFull({ id: 'A1', feedback: 'fb1' }),
            makeRowFull({ id: 'A2', feedback: 'fb2' }),
        ];
        // 在 A1 與 A2 之間插入 NEW，導致 A2 索引位移
        const newData = [
            makeRowFull({ id: 'A1', feedback: 'fb1' }),
            makeRowFull({ id: 'NEW', feedback: 'fbN' }),
            makeRowFull({ id: 'A2', feedback: 'fb2' }),
        ];
        const { added, changed } = diffRows(oldData, newData);
        expect(added.map(r => r[COL.ID])).toEqual(['NEW']);
        expect(changed).toHaveLength(0); // 舊版用索引比對會在此狂報誤報
    });

    it('刪除一列 → 不誤報剩餘列', () => {
        const oldData = [
            makeRowFull({ id: 'A1', feedback: 'fb1' }),
            makeRowFull({ id: 'A2', feedback: 'fb2' }),
        ];
        const newData = [makeRowFull({ id: 'A2', feedback: 'fb2' })];
        const { added, changed } = diffRows(oldData, newData);
        expect(added).toHaveLength(0);
        expect(changed).toHaveLength(0);
    });

    it('重新排序 → 不誤報', () => {
        const oldData = [
            makeRowFull({ id: 'A1', feedback: 'fb1' }),
            makeRowFull({ id: 'A2', feedback: 'fb2' }),
        ];
        const newData = [
            makeRowFull({ id: 'A2', feedback: 'fb2' }),
            makeRowFull({ id: 'A1', feedback: 'fb1' }),
        ];
        const { added, changed } = diffRows(oldData, newData);
        expect(added).toHaveLength(0);
        expect(changed).toHaveLength(0);
    });

    it('無單號的列被忽略', () => {
        const oldData = [makeRowFull({ id: 'A1' })];
        const newData = [makeRowFull({ id: 'A1' }), makeRowFull({ id: '' })];
        const { added } = diffRows(oldData, newData);
        expect(added).toHaveLength(0);
    });

    it('非陣列輸入 → 空結果', () => {
        expect(diffRows(null, null)).toEqual({ added: [], changed: [] });
    });
});

// ============================================================
// CORS proxy helpers (修正項 5)
// ============================================================
describe('PROXY_STRATEGIES', () => {
    it('包含三個 proxy，且 AllOrigins 標記 wrapped', () => {
        expect(PROXY_STRATEGIES).toHaveLength(3);
        const allOrigins = PROXY_STRATEGIES.find(s => s.wrapped);
        expect(allOrigins.name).toBe('AllOrigins (JSON)');
    });

    it('getUrl 會正確編碼目標 URL', () => {
        const codetabs = PROXY_STRATEGIES[0];
        const url = codetabs.getUrl('https://x.com/a.json?key=1&b=2');
        expect(url).toContain(encodeURIComponent('https://x.com/a.json?key=1&b=2'));
    });
});

describe('isHtmlErrorPage', () => {
    it('HTML 頁面 → true', () => {
        expect(isHtmlErrorPage('<!DOCTYPE html><html>...</html>')).toBe(true);
        expect(isHtmlErrorPage('  <html><body>login</body></html>')).toBe(true);
    });
    it('JSON 字串 → false', () => {
        expect(isHtmlErrorPage('{"issue":{}}')).toBe(false);
        expect(isHtmlErrorPage('')).toBe(false);
        expect(isHtmlErrorPage(null)).toBe(false);
    });
});

describe('unwrapProxyResponse', () => {
    const plain = PROXY_STRATEGIES[0];          // CodeTabs（非 wrapped）
    const wrapped = PROXY_STRATEGIES.find(s => s.wrapped); // AllOrigins

    it('非 wrapped proxy → 直接 parse', () => {
        expect(unwrapProxyResponse(plain, '{"issue":{"id":1}}')).toEqual({ issue: { id: 1 } });
    });
    it('wrapped proxy → 解開 contents 內層 JSON', () => {
        const text = JSON.stringify({ contents: JSON.stringify({ issue: { id: 9 } }) });
        expect(unwrapProxyResponse(wrapped, text)).toEqual({ issue: { id: 9 } });
    });
    it('wrapped 但 contents 為空 → null', () => {
        expect(unwrapProxyResponse(wrapped, JSON.stringify({ contents: '' }))).toBeNull();
    });
    it('無效 JSON → null', () => {
        expect(unwrapProxyResponse(plain, '<html>error</html>')).toBeNull();
    });
});

// ============================================================
// computeGanttLayout - 甘特圖時間軸寬度自適應（延展 / RWD 收縮）
// ============================================================
describe('computeGanttLayout', () => {
    it('寬螢幕：日欄延展填滿，左欄達上限 400', () => {
        const { leftPanelWidth, dayWidth } = computeGanttLayout(1735, 30);
        expect(leftPanelWidth).toBe(400);            // min(400, 1735*0.28=485.8) = 400
        expect(dayWidth).toBe(44);                   // floor((1735-400)/30) = 44，介於 [40,120]
    });

    it('窄螢幕：日欄縮到下限 40、左欄縮到下限 200', () => {
        const { leftPanelWidth, dayWidth } = computeGanttLayout(695, 30);
        expect(leftPanelWidth).toBe(200);            // max(200, 695*0.28=194.6) = 200
        expect(dayWidth).toBe(40);                   // floor((695-200)/30)=16 → clamp 40
    });

    it('左欄寬為 containerWidth 的 28%（四捨五入），夾在 [200,400]', () => {
        expect(computeGanttLayout(500, 30).leftPanelWidth).toBe(200);   // 140 → 下限 200
        expect(computeGanttLayout(900, 30).leftPanelWidth).toBe(252);   // 900*0.28=252
        expect(computeGanttLayout(2000, 30).leftPanelWidth).toBe(400);  // 560 → 上限 400
    });

    it('超寬螢幕：日欄夾在上限 120', () => {
        expect(computeGanttLayout(10000, 30).dayWidth).toBe(120);       // floor(9600/30)=320 → clamp 120
    });

    it('floor 保證內容總寬不超過容器（避免溢出/回饋迴圈）', () => {
        for (const cw of [1735, 1600, 1440, 1200, 900]) {
            const { leftPanelWidth, dayWidth } = computeGanttLayout(cw, 30);
            // 只有在「未觸及 dayWidth 下限」時才保證填滿不溢出
            if (dayWidth > 40) {
                expect(leftPanelWidth + dayWidth * 30).toBeLessThanOrEqual(cw);
            }
        }
    });

    it('可自訂 min / max 日寬', () => {
        expect(computeGanttLayout(695, 30, { minDayWidth: 60 }).dayWidth).toBe(60);
        expect(computeGanttLayout(10000, 30, { maxDayWidth: 80 }).dayWidth).toBe(80);
    });

    it('可自訂顯示天數', () => {
        const { dayWidth } = computeGanttLayout(1735, 14);
        expect(dayWidth).toBe(95);                   // floor((1735-400)/14)=95
    });

    it('ganttDays 為 0 不會除以零', () => {
        const r = computeGanttLayout(1000, 0);
        expect(Number.isFinite(r.dayWidth)).toBe(true);
    });
});
