import React from 'react';
import axios from 'axios';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route } from 'react-router-dom';
import ReceiptDetail from '../pages/billing/receipt';

jest.mock('axios');

describe('ReceiptDetail integration', () => {
    test('loads receipt data and renders official receipt sections', async () => {
        axios.get.mockResolvedValueOnce({
            data: {
                id: '450-21',
                timestamp: '2026-03-29T01:49:41.000Z',
                walletTxId: 'tx-55',
                invoice: {
                    id: '450-21',
                    buildingName: 'Malai',
                    tokenAmount: 1750,
                    consumedKwh: 500,
                    marketPurchasedKwh: 100,
                    billableKwh: 400,
                    month: 3,
                    year: 2026,
                    status: 'paid',
                },
                building: {
                    id: 38,
                    address: '118 Seri Thai Rd',
                    province: 'Bangkok',
                    postal: '10240',
                },
                owner: {
                    role: 'PROSUMER',
                },
                walletTx: {
                    id: '88',
                },
            },
        });

        render(
            <MemoryRouter initialEntries={['/receipt/450-21']}>
                <Route path="/receipt/:id">
                    <ReceiptDetail />
                </Route>
            </MemoryRouter>
        );

        expect(screen.getByText(/Loading receipt/i)).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByText('OFFICIAL RECEIPT')).toBeInTheDocument();
        });

        expect(screen.getByText('Received From')).toBeInTheDocument();
        expect(screen.getByText('Receipt Information')).toBeInTheDocument();
        expect(screen.getByText('Malai')).toBeInTheDocument();
        expect(screen.getByText('Payment Breakdown')).toBeInTheDocument();
        expect(screen.getByText('Blockchain Verified Document')).toBeInTheDocument();
    });
});
