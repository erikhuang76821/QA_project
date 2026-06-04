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
    findKeyAnomalies,
    computeNotifications,
    changeFingerprint,
    addFingerprint,
    isDuplicateNotification,
    recordNotification,
    DEDUPE_TTL_MS,
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

    it('向後相容：第三參數傳數字仍當 idIndex 用', () => {
        const oldData = [makeRowFull({ id: 'A1', feedback: '無' })];
        const newData = [makeRowFull({ id: 'A1', feedback: 'X' })];
        const { changed } = diffRows(oldData, newData, COL.ID);
        expect(changed).toHaveLength(1);
    });
});

// ============================================================
// diffRows keyMode:'row' - 修正 B4：同名/無單號任務不再互相碰撞狂報
// ============================================================
describe("diffRows keyMode:'row'", () => {
    it('兩列無單號、同名但反饋不同 → 各自穩定追蹤，不誤報異動', () => {
        // 還原回報情境：同名「開發中測試支援」兩列，一列「無」一列已有反饋
        const rowA = makeRowFull({ id: '', name: '【品檢】開發中測試支援', feedback: '無' });
        const rowB = makeRowFull({ id: '', name: '【品檢】開發中測試支援', feedback: '11:21提供版本，但進不去' });
        const oldData = [rowA, rowB];
        const newData = [
            makeRowFull({ id: '', name: '【品檢】開發中測試支援', feedback: '無' }),
            makeRowFull({ id: '', name: '【品檢】開發中測試支援', feedback: '11:21提供版本，但進不去' }),
        ];
        const { added, changed } = diffRows(oldData, newData, { keyMode: 'row' });
        expect(added).toHaveLength(0);
        expect(changed).toHaveLength(0); // 'id' 模式下這裡會狂報，'row' 模式收斂
    });

    it("'id' 模式下同名無單號列被忽略（對照組，凸顯舊行為）", () => {
        const oldData = [makeRowFull({ id: '', feedback: '無' })];
        const newData = [makeRowFull({ id: '', feedback: 'X' })];
        // 預設 'id' 模式忽略空單號 → 無法偵測，這正是改用 'row' 模式的動機
        expect(diffRows(oldData, newData).changed).toHaveLength(0);
    });

    it("'row' 模式下無單號列的反饋變更會被偵測（同位比對）", () => {
        const oldData = [makeRowFull({ id: '', feedback: '無' })];
        const newData = [makeRowFull({ id: '', feedback: 'Bug 修復中' })];
        const { changed } = diffRows(oldData, newData, { keyMode: 'row' });
        expect(changed).toHaveLength(1);
        expect(changed[0].feedbackChanged).toBe(true);
    });

    it('重複單號的兩列 → 加序號去碰撞，各自獨立比對', () => {
        const oldData = [
            makeRowFull({ id: 'DUP', feedback: 'a' }),
            makeRowFull({ id: 'DUP', feedback: 'b' }),
        ];
        const newData = [
            makeRowFull({ id: 'DUP', feedback: 'a' }),
            makeRowFull({ id: 'DUP', feedback: 'b' }),
        ];
        // 舊版 last-write-wins 會把第一列比成第二列而誤報；加序號後收斂
        expect(diffRows(oldData, newData, { keyMode: 'row' }).changed).toHaveLength(0);
    });
});

// ============================================================
// computeNotifications - 端到端驗證「不會再重複此 bug」
//   這是 app 內 checkAndNotify 實際呼叫的同一份決策函式，
//   故以下斷言＝直接驗證線上行為。
// ============================================================
describe('computeNotifications - 重複狂報回歸驗證', () => {
    // 模擬「自動刷新」：把同一份/演進的資料逐輪餵進去，累計實際送出的通知數。
    const runRefreshCycles = (snapshots, { intervalMs = 5 * 60 * 1000 } = {}) => {
        let prev = null;
        let ledger = {};
        let sent = 0;
        const log = [];
        snapshots.forEach((data, i) => {
            const now = 1_000_000 + i * intervalMs;
            if (prev === null) { prev = data; return; } // 首輪只建基準（對齊 checkAndNotify）
            const { notifications, ledger: next } = computeNotifications(prev, data, ledger, now);
            sent += notifications.length;
            notifications.forEach(n => log.push({ cycle: i, kind: n.kind, fp: n.fingerprint }));
            prev = data;
            ledger = next;
        });
        return { sent, log };
    };

    // 還原回報情境：同名、無單號的「開發中測試支援」兩列，反饋從未再變，
    // 試算表每 5 分鐘回傳「完全相同」的資料。舊版每輪狂報，新版應 0 通知。
    const buggyRow = (feedback) =>
        makeRowFull({ id: '', name: '【品檢】開發中測試支援', feedback });
    const buggySnapshot = () => [buggyRow('無'), buggyRow('11:21提供版本，但進不去')];

    it('同名無單號、資料不變跑 5 輪 → 0 通知（核心回歸）', () => {
        const snapshots = Array.from({ length: 5 }, buggySnapshot);
        const { sent } = runRefreshCycles(snapshots);
        expect(sent).toBe(0);
    });

    it('反饋「真的改一次」後又連續 4 輪不變 → 只送 1 次', () => {
        const snapshots = [
            buggySnapshot(),                                   // 基準
            [buggyRow('無'), buggyRow('改成 Bug 修復中')],     // 第二列反饋真的變了 → 送 1 次
            [buggyRow('無'), buggyRow('改成 Bug 修復中')],     // 之後不變
            [buggyRow('無'), buggyRow('改成 Bug 修復中')],
            [buggyRow('無'), buggyRow('改成 Bug 修復中')],
        ];
        const { sent, log } = runRefreshCycles(snapshots);
        expect(sent).toBe(1);
        expect(log[0].kind).toBe('change');
    });

    it('TTL 過期後同一狀態若再次出現 → 會再送（不是永久靜音）', () => {
        const snapshots = [
            [buggyRow('A')],
            [buggyRow('B')], // 變更 → 送
            [buggyRow('B')], // 不變
            [buggyRow('B')], // 不變
        ];
        // 用很短的 interval 不會過期；改用超過 6h 的間隔讓 ledger 過期
        const sixHoursPlus = 6 * 60 * 60 * 1000 + 60_000;
        let prev = null, ledger = {}, sent = 0;
        // 第一次變更送出
        prev = snapshots[0];
        let r = computeNotifications(prev, snapshots[1], ledger, 0); sent += r.notifications.length; ledger = r.ledger; prev = snapshots[1];
        // TTL 內重複 → 不送
        r = computeNotifications(prev, snapshots[2], ledger, 1000); sent += r.notifications.length; ledger = r.ledger; prev = snapshots[2];
        expect(sent).toBe(1);
        // 模擬「A→B 又被改回 A 再改成 B」在 6h 後重演：先回 A 再到 B，且時間已過 TTL
        let r2 = computeNotifications(prev, [buggyRow('A')], ledger, sixHoursPlus); ledger = r2.ledger; prev = [buggyRow('A')];
        let r3 = computeNotifications(prev, [buggyRow('B')], ledger, sixHoursPlus + 1000);
        expect(r3.notifications.length).toBe(1); // 過了 TTL，視為新事件，正常通知
    });

    it('對照組：舊邏輯（單號鍵 + 無 dedupe）在重複單號下會每輪狂報', () => {
        // 重現 bug：兩列共用同一單號（如開發中任務暫借一個單號），反饋一無一有。
        const dupRow = (fb) => makeRowFull({ id: 'DEV-TMP', name: '【品檢】開發中測試支援', feedback: fb });
        const snap = () => [dupRow('無'), dupRow('11:21提供版本，但進不去')];
        let oldStyleSent = 0;
        let prev = snap();
        for (let i = 0; i < 4; i++) {
            // 舊行為：keyMode 'id'（預設）+ 直接送、無 dedupe
            const { changed } = diffRows(prev, snap()); // last-write-wins 導致同列每輪錯配
            oldStyleSent += changed.length;
            prev = snap();
        }
        expect(oldStyleSent).toBeGreaterThan(0); // 舊邏輯：狂報（每輪都有 changed）

        // 新機制：同一情境跑同樣輪數 → 0 通知
        const newSnaps = Array.from({ length: 5 }, snap);
        expect(runRefreshCycles(newSnaps).sent).toBe(0);
    });

    it('新增任務同樣只報一次（重排/重複刷新不重報）', () => {
        const base = [makeRowFull({ id: 'A1', name: '舊任務', feedback: '無' })];
        const withNew = [
            makeRowFull({ id: 'A1', name: '舊任務', feedback: '無' }),
            makeRowFull({ id: 'A2', name: '新任務', feedback: '無' }),
        ];
        const snapshots = [base, withNew, withNew, withNew];
        const { sent, log } = runRefreshCycles(snapshots);
        expect(sent).toBe(1);
        expect(log[0].kind).toBe('add');
    });
});

// ============================================================
// findKeyAnomalies - 偵測缺單號/重複單號的脆弱列
// ============================================================
describe('findKeyAnomalies', () => {
    it('無單號且同名重複 → riskyNames', () => {
        const data = [
            makeRowFull({ id: '', name: '【品檢】開發中測試支援' }),
            makeRowFull({ id: '', name: '【品檢】開發中測試支援' }),
        ];
        const { riskyNames, duplicateIds } = findKeyAnomalies(data);
        expect(duplicateIds).toHaveLength(0);
        expect(riskyNames).toEqual([{ name: '【品檢】開發中測試支援', count: 2 }]);
    });

    it('重複單號 → duplicateIds', () => {
        const data = [makeRowFull({ id: 'DUP' }), makeRowFull({ id: 'DUP' }), makeRowFull({ id: 'X' })];
        const { duplicateIds, riskyNames } = findKeyAnomalies(data);
        expect(duplicateIds).toEqual([{ id: 'DUP', count: 2 }]);
        expect(riskyNames).toHaveLength(0);
    });

    it('各有唯一單號 → 無瑕疵', () => {
        const data = [makeRowFull({ id: 'A1' }), makeRowFull({ id: 'A2' })];
        expect(findKeyAnomalies(data)).toEqual({ duplicateIds: [], riskyNames: [] });
    });

    it('無單號但不同名 → 不算風險', () => {
        const data = [makeRowFull({ id: '', name: 'X' }), makeRowFull({ id: '', name: 'Y' })];
        expect(findKeyAnomalies(data).riskyNames).toHaveLength(0);
    });

    it('TYPE(B欄)空白的列被忽略', () => {
        const data = [
            makeRowFull({ id: '', name: '同名', type: '' }),
            makeRowFull({ id: '', name: '同名', type: '' }),
        ];
        expect(findKeyAnomalies(data).riskyNames).toHaveLength(0);
    });

    it('非陣列 → 空結果', () => {
        expect(findKeyAnomalies(null)).toEqual({ duplicateIds: [], riskyNames: [] });
    });
});

// ============================================================
// 通知去重 dedupe（修正 B4 最終防線）
// ============================================================
describe('通知去重 dedupe', () => {
    it('changeFingerprint 對同一變動穩定、不含時間戳', () => {
        const a = changeFingerprint('任務X', 'J', '無', '11:21');
        const b = changeFingerprint('任務X', 'J', '無', '11:21');
        expect(a).toBe(b);
    });

    it('changeFingerprint 會正規化「無/空白」', () => {
        expect(changeFingerprint('T', 'J', '無', 'x')).toBe(changeFingerprint('T', 'J', '空白', 'x'));
    });

    it('不同新值 → 不同指紋（真實變動仍會通知）', () => {
        expect(changeFingerprint('T', 'J', '無', 'a')).not.toBe(changeFingerprint('T', 'J', '無', 'b'));
    });

    it('TTL 內視為重複、過期後不再視為重複', () => {
        const now = 1_000_000;
        let ledger = recordNotification({}, 'fp1', now);
        expect(isDuplicateNotification(ledger, 'fp1', now + 1000)).toBe(true);
        expect(isDuplicateNotification(ledger, 'fp1', now + DEDUPE_TTL_MS + 1)).toBe(false);
        expect(isDuplicateNotification(ledger, 'fp-other', now)).toBe(false);
    });

    it('recordNotification 清掉過期項、保留有效項（不可變更新）', () => {
        const now = 10_000_000;
        const stale = { old: now - DEDUPE_TTL_MS - 1, fresh: now - 1000 };
        const next = recordNotification(stale, 'newfp', now);
        expect(next.old).toBeUndefined();
        expect(next.fresh).toBe(now - 1000);
        expect(next.newfp).toBe(now);
        expect(stale.newfp).toBeUndefined(); // 原物件未被改動
    });

    it('addFingerprint 用任務名+附加識別，不綁列號', () => {
        expect(addFingerprint('新任務', '阿穆')).toBe(addFingerprint('新任務', '阿穆'));
        expect(addFingerprint('新任務', '阿穆')).not.toBe(addFingerprint('新任務', '小雄'));
    });

    it('模擬狂報情境：同一異動跑 5 輪只送 1 次', () => {
        let ledger = {};
        let sent = 0;
        for (let i = 0; i < 5; i++) {
            const now = 1_000 + i * 5 * 60 * 1000; // 每 5 分鐘一輪
            const fp = changeFingerprint('【品檢】開發中測試支援', 'J', '無', '11:21提供版本，但進不去');
            if (!isDuplicateNotification(ledger, fp, now)) {
                sent++;
                ledger = recordNotification(ledger, fp, now);
            }
        }
        expect(sent).toBe(1);
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
