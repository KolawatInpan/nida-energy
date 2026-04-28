import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ApprovedRequest from '../pages/admin/approvedRequest';
import { getPendingMeters, getUserFromBuilding, updateMeter } from '../core/data_connecter/meter';

const mockConfirm = jest.fn();
const mockMessageSuccess = jest.fn();
const mockMessageError = jest.fn();

jest.mock('../core/data_connecter/meter', () => ({
    getPendingMeters: jest.fn(),
    getUserFromBuilding: jest.fn(),
    updateMeter: jest.fn(),
}));

jest.mock('../global/TORContext', () => ({
    useTOR: () => ({ showTOR: false }),
}));

jest.mock('antd', () => ({
    Modal: {
        confirm: (...args) => mockConfirm(...args),
    },
    message: {
        success: (...args) => mockMessageSuccess(...args),
        error: (...args) => mockMessageError(...args),
    },
}));

describe('ApprovedRequest integration', () => {
    beforeEach(() => {
        mockConfirm.mockClear();
        mockMessageSuccess.mockClear();
        mockMessageError.mockClear();

        getPendingMeters.mockResolvedValue([
            {
                id: 'REQ-001',
                building: 'Malai',
                buildingId: 38,
                type: 'produce',
                snid: 'MTR-001',
                dateSubmit: '2026-03-29',
            },
        ]);
        getUserFromBuilding.mockResolvedValue([
            { name: 'Owner One', email: 'owner@example.com' },
        ]);
        updateMeter.mockResolvedValue({ ok: true });

        mockConfirm.mockImplementation(({ onOk }) => {
            if (onOk) {
                return Promise.resolve(onOk());
            }
            return Promise.resolve();
        });
    });

    test('loads pending request and approves a meter request', async () => {
        render(
            <MemoryRouter>
                <ApprovedRequest />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('REQ-001')).toBeInTheDocument();
        });

        expect(screen.getByText('Owner One')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Approve/i }));

        await waitFor(() => {
            expect(updateMeter).toHaveBeenCalledWith('MTR-001', { status: 'approved' });
        });

        expect(mockMessageSuccess).toHaveBeenCalled();
        await waitFor(() => {
            expect(screen.queryByText('REQ-001')).not.toBeInTheDocument();
        });
    });
});
