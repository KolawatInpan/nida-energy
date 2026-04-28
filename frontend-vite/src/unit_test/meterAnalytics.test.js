import { buildHourlyTrend, buildTrailingDailyTrend, buildXAxisLabels } from '../utils/meterAnalytics';

describe('meterAnalytics helpers', () => {
    test('buildHourlyTrend uses the latest hourly row', () => {
        const rows = [
            { date: '2026-03-30', hours: { h0: 1, h1: 2 } },
            { date: '2026-03-31', hours: { h0: 3, h1: 4, h23: 5 } },
        ];

        const result = buildHourlyTrend(rows);

        expect(result.labels).toHaveLength(24);
        expect(result.values[0]).toBe(3);
        expect(result.values[1]).toBe(4);
        expect(result.values[23]).toBe(5);
        expect(result.total).toBe(12);
        expect(result.peak).toBe(5);
    });

    test('buildTrailingDailyTrend spans across month boundary', () => {
        const monthRows = [
            {
                year: 2026,
                month: 3,
                rows: [{ year: 2026, month: 3, days: { d30: 10, d31: 20 } }],
            },
            {
                year: 2026,
                month: 4,
                rows: [{ year: 2026, month: 4, days: { d1: 30, d2: 40 } }],
            },
        ];

        const result = buildTrailingDailyTrend(monthRows, 4, new Date('2026-04-02T10:00:00'));

        expect(result.labels).toEqual(['30/03', '31/03', '01/04', '02/04']);
        expect(result.values).toEqual([10, 20, 30, 40]);
        expect(result.total).toBe(100);
        expect(result.peak).toBe(40);
    });

    test('buildXAxisLabels shows all week labels and sparse month labels', () => {
        const week = buildXAxisLabels(['a', 'b', 'c', 'd', 'e', 'f', 'g'], 'week');
        const month = buildXAxisLabels(Array.from({ length: 10 }, (_, i) => `d${i + 1}`), 'month');

        expect(week).toHaveLength(7);
        expect(month.map((item) => item.label)).toEqual(['d1', 'd4', 'd7', 'd10']);
    });
});
