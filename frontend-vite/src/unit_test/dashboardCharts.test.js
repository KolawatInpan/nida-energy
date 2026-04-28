import { buildComparisonXAxisLabels, buildNiceScale, swapComparisonSelection } from '../utils/dashboardCharts';

describe('dashboardCharts helpers', () => {
    test('buildComparisonXAxisLabels keeps every label for 7d and sparse labels for 30d', () => {
        const labels7 = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7'];
        const labels30 = Array.from({ length: 12 }, (_, index) => `d${index + 1}`);

        expect(Array.from(buildComparisonXAxisLabels(labels7, '7d'))).toEqual(labels7);
        expect(Array.from(buildComparisonXAxisLabels(labels30, '30d'))).toEqual(['d1', 'd6', 'd11', 'd12']);
    });

    test('buildNiceScale tightens positive clustered values', () => {
        const scale = buildNiceScale([52, 58, 61, 73]);

        expect(scale.min).toBe(40);
        expect(scale.max).toBe(80);
        expect(scale.ticks).toEqual([80, 70, 60, 50, 40]);
    });

    test('swapComparisonSelection swaps positions when selecting duplicate building', () => {
        expect(swapComparisonSelection('Malai', 'Ratchaphruek', 'Ratchaphruek', 'A')).toEqual({
            a: 'Ratchaphruek',
            b: 'Malai',
        });

        expect(swapComparisonSelection('Malai', 'Ratchaphruek', 'Malai', 'B')).toEqual({
            a: 'Ratchaphruek',
            b: 'Malai',
        });
    });
});
