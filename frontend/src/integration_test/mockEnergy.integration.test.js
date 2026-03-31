import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MockEnergy from '../pages/trading/mockEnergy';
import { getMeters, insertRunningLogsBulk, resetEnergyLogs } from '../core/data_connecter/mockEnergy';

jest.mock('../core/data_connecter/mockEnergy', () => ({
    getMeters: jest.fn(),
    insertRunningLogsBulk: jest.fn(),
    resetEnergyLogs: jest.fn(),
}));

describe('MockEnergy integration', () => {
    beforeEach(() => {
        getMeters.mockResolvedValue([
            { snid: 'P-001', meterName: 'Producer 1', buildingName: 'Malai', type: 'produce' },
            { snid: 'C-001', meterName: 'Consumer 1', buildingName: 'Ratchaphruek', type: 'consume' },
        ]);
        insertRunningLogsBulk.mockResolvedValue({ ok: true });
        resetEnergyLogs.mockResolvedValue({
            cleared: {
                runningMeter: 24,
                hourlyEnergy: 1,
                dailyEnergy: 1,
                weeklyEnergy: 1,
                monthlyEnergy: 1,
            },
        });
        window.alert = jest.fn();
        window.confirm = jest.fn(() => true);
    });

    test('loads meters and generates bulk running logs for selected meter', async () => {
        render(<MockEnergy />);

        await waitFor(() => {
            expect(screen.getByText(/Producer 1 - Malai/i)).toBeInTheDocument();
        });

        fireEvent.click(screen.getAllByRole('checkbox')[0]);
        fireEvent.click(screen.getByRole('button', { name: /^Generate$/i }));

        await waitFor(() => {
            expect(insertRunningLogsBulk).toHaveBeenCalledTimes(1);
        });

        const payload = insertRunningLogsBulk.mock.calls[0][0];
        expect(Array.isArray(payload)).toBe(true);
        expect(payload.length).toBeGreaterThan(0);
        expect(payload[0]).toMatchObject({
            snid: 'P-001',
        });

        await waitFor(() => {
            expect(screen.getByText(/Generation complete/i)).toBeInTheDocument();
        });
    });
});
