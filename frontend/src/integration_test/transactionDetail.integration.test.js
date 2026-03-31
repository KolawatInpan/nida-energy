import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route } from 'react-router-dom';
import TransactionDetail from '../pages/transactions/transactionDetail';
import {
    getTransactionById,
    getTransactionVerificationPreview,
    verifyTransaction,
} from '../core/data_connecter/transactionDetail';

jest.mock('../core/data_connecter/transactionDetail', () => ({
    getTransactionById: jest.fn(),
    getTransactionVerificationPreview: jest.fn(),
    verifyTransaction: jest.fn(),
}));

describe('TransactionDetail integration', () => {
    beforeEach(() => {
        getTransactionById.mockResolvedValue({
            success: true,
            data: {
                txid: '2025-001522',
                type: 'MARKETPLACE_SALE',
                tokenAmount: 3245,
                status: 'verified',
                buildingName: 'Malai Building',
                snid: 'BLD-038',
                walletId: '13',
                timestamp: '2026-03-29T01:49:41.000Z',
                verifiedAt: '2026-03-29T01:49:49.000Z',
                verificationMethod: 'self_transaction',
                verificationStatus: 'verified',
                payloadHash: '0xpayloadhash',
                txHash: '0xtxhash',
                blockNumber: 1234498,
                gasUsed: 21000,
                effectiveGasPrice: 32,
            },
        });
        getTransactionVerificationPreview.mockResolvedValue({
            success: true,
            data: {
                enabled: true,
                payloadHash: '0xpayloadhash',
                chainId: 31337,
            },
        });
        verifyTransaction.mockResolvedValue({
            success: true,
            data: { verified: true, txHash: '0xtxhash' },
        });
    });

    test('renders financial summary, proof of record, and timeline', async () => {
        render(
            <MemoryRouter initialEntries={['/transactions/2025-001522']}>
                <Route path="/transactions/:txid">
                    <TransactionDetail />
                </Route>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText(/Transaction Details & Receipt Confirmation/i)).toBeInTheDocument();
        });

        expect(screen.getByText('Financial Summary')).toBeInTheDocument();
        expect(screen.getByText('Blockchain Proof of Record')).toBeInTheDocument();
        expect(screen.getByText('Transaction Timeline')).toBeInTheDocument();
        expect(screen.getByText('Malai Building')).toBeInTheDocument();
        expect(screen.getByText('Blockchain Verified')).toBeInTheDocument();
        expect(screen.getByText('View on Local Blockchain Comparison')).toBeInTheDocument();
    });
});
