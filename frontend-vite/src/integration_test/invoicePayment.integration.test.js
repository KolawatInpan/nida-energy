import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route } from 'react-router-dom';
import InvoicePayment from '../pages/billing/invoicePayment';
import { getInvoiceById, payInvoice } from '../core/data_connecter/invoice';
import { getWalletBalance } from '../core/data_connecter/wallet';

jest.mock('../core/data_connecter/invoice', () => ({
    getInvoiceById: jest.fn(),
    payInvoice: jest.fn(),
}));

jest.mock('../core/data_connecter/wallet', () => ({
    getWalletBalance: jest.fn(),
}));

describe('InvoicePayment integration', () => {
    beforeEach(() => {
        getInvoiceById.mockResolvedValue({
            id: 'INV-001',
            buildingName: 'Malai',
            month: 3,
            year: 2026,
            tokenAmount: 1750,
            consumedKwh: 500,
            marketPurchasedKwh: 100,
            billableKwh: 400,
            peakkWH: 50,
            toWId: '13',
            status: 'unpaid',
        });
        getWalletBalance.mockResolvedValue({ data: { balance: 5000 } });
        payInvoice.mockResolvedValue({
            invoice: {
                id: 'INV-001',
                status: 'paid',
                receipt: { id: 'REC-001' },
            },
            wallet: {
                tokenBalance: 3250,
            },
            receipt: {
                id: 'REC-001',
                timestamp: '2026-03-29T01:49:41.000Z',
            },
            transaction: {
                txid: 'TX-001',
            },
        });
    });

    test('loads invoice, proceeds to confirm step, and completes payment', async () => {
        render(
            <MemoryRouter initialEntries={['/invoice-payment/INV-001']}>
                <Route path="/invoice-payment/:id">
                    <InvoicePayment />
                </Route>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText(/Invoice Details/i)).toBeInTheDocument();
        });

        expect(screen.getByText('Malai')).toBeInTheDocument();
        expect(getInvoiceById).toHaveBeenCalledWith('INV-001');
        expect(getWalletBalance).toHaveBeenCalledWith('13');

        fireEvent.click(screen.getByRole('checkbox'));
        fireEvent.click(screen.getByRole('button', { name: /Pay .* Token Now/i }));

        await waitFor(() => {
            expect(screen.getByText(/Confirm Invoice Payment/i)).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /Confirm Pay/i }));

        await waitFor(() => {
            expect(screen.getByText(/Payment Completed!/i)).toBeInTheDocument();
        });

        expect(payInvoice).toHaveBeenCalledWith('INV-001');
        expect(screen.getByText(/Transaction ID/i)).toBeInTheDocument();
        expect(screen.getByText('TX-001')).toBeInTheDocument();
    });
});
