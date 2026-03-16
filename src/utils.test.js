import { describe, it, expect } from 'vitest';
import {
    formatSimpleDate,
    getMonthStr,
    getDaysDiff,
    isLate,
    isFeedbackCountable,
    getMergedTypeName,
    normalize,
} from './utils.js';

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
