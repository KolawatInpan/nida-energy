import { buildThreeHourSeries, getLatestMeterDate, toNumeric } from '../utils/energyAnalytics';

describe('energyAnalytics helpers', () => {
    test('toNumeric converts safe numeric inputs', () => {
        expect(toNumeric('1,234.56')).toBeCloseTo(1234.56, 2);
        expect(toNumeric(null)).toBe(0);
        expect(toNumeric(undefined)).toBe(0);
        expect(toNumeric('bad-value')).toBe(0);
    });

    test('getLatestMeterDate returns the latest available timestamp date', () => {
        const meters = [
            { timestamp: '2026-03-29T10:00:00.000Z' },
            { raw: { timestamp: '2026-03-31T05:30:00.000Z' } },
            { timestamp: '2026-03-30T12:00:00.000Z' },
        ];

        expect(getLatestMeterDate(meters)).toBe('2026-03-31');
    });

    test('buildThreeHourSeries groups hourly values into 3-hour buckets', () => {
        const payload = {
            production: {
                datetime: ['2026-03-31 00:00', '2026-03-31 01:00', '2026-03-31 03:00'],
                value: [10, 5, 9],
            },
            consumption: {
                datetime: ['2026-03-31 00:00', '2026-03-31 04:00'],
                value: [7, 8],
            },
            battery: {
                datetime: ['2026-03-31 18:00', '2026-03-31 19:00'],
                value: [3, 2],
            },
        };

        const result = buildThreeHourSeries(payload);

        expect(result).toHaveLength(8);
        expect(result[0]).toMatchObject({
            label: '00:00',
            pvProduction: 15,
            consumption: 7,
            batteryDischarge: 0,
        });
        expect(result[1]).toMatchObject({
            label: '03:00',
            pvProduction: 9,
            consumption: 8,
            batteryDischarge: 0,
        });
        expect(result[6]).toMatchObject({
            label: '18:00',
            batteryDischarge: 5,
        });
    });
});
