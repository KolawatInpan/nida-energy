import {
    buildTransactionCompareRows,
    buildTransactionCompareSummary,
    buildTransactionDetailView,
    buildTransactionTimeline,
    compareValues,
    normalizeCompareValue,
} from '../utils/transactionMappers';

describe('transactionMappers helpers', () => {
    test('normalizeCompareValue and compareValues handle numeric and string payloads', () => {
        expect(normalizeCompareValue(true)).toBe('true');
        expect(normalizeCompareValue('  abc  ')).toBe('abc');
        expect(compareValues('12.5000', 12.5)).toBe(true);
        expect(compareValues('ACTIVE', 'active')).toBe(false);
    });

    test('buildTransactionDetailView maps blockchain transaction metadata into screen view model', () => {
        const view = buildTransactionDetailView({
            txid: '2025-001',
            type: 'MARKETPLACE_SALE',
            tokenAmount: 1750,
            status: 'verified',
            buildingName: 'Ratchaphruek',
            walletId: '14',
            timestamp: '2026-03-29T01:49:41.000Z',
            verifiedAt: '2026-03-29T01:49:45.000Z',
            verificationMethod: 'self_transaction',
            verificationStatus: 'verified',
            payloadHash: '0xpayload',
            txHash: '0xtx',
            blockNumber: 10,
            gasUsed: 22280,
            effectiveGasPrice: 1263326773,
        }, '2025-001');

        expect(view.id).toBe('2025-001');
        expect(view.amount).toBe(1750);
        expect(view.signedAmount).toBe(1750);
        expect(view.type).toContain('Marketplace');
        expect(view.buildingName).toBe('Ratchaphruek');
        expect(view.walletId).toBe('14');
        expect(view.txHash).toBe('0xtx');
        expect(view.payloadHash).toBe('0xpayload');
        expect(view.blockNumber).toBe(10);
        expect(view.confirmationSeconds).toBe(4);
        expect(view.canVerify).toBe(false);
    });

    test('buildTransactionTimeline creates pending timeline when tx hash is absent', () => {
        const view = buildTransactionDetailView({
            txid: '2025-002',
            type: 'wallet_topup',
            tokenAmount: 500,
            status: 'pending',
            buildingName: 'Malai',
            timestamp: '2026-03-29T01:49:41.000Z',
        }, '2025-002');

        const timeline = buildTransactionTimeline(view, { enabled: false });

        expect(timeline).toHaveLength(3);
        expect(timeline[1].description).toContain('disabled');
        expect(timeline[2]).toMatchObject({
            title: 'Awaiting Blockchain Verification',
            complete: false,
            time: 'Pending',
        });
    });

    test('buildTransactionCompareRows and summary compare stored payload snapshot correctly', () => {
        const transaction = {
            txid: '2025-003',
            walletId: '14',
            buildingName: 'Malai',
            snid: 'MTR-1',
            type: 'MARKETPLACE_PURCHASE',
            tokenAmount: 1750,
            status: 'verified',
            timestamp: '2026-03-29T01:49:41.000Z',
            txHash: '0xtx',
            verificationStatus: 'verified',
        };
        const preview = {
            payloadSource: 'stored',
            payload: {
                txid: '2025-003',
                walletId: '14',
                buildingName: 'Malai',
                snid: 'MTR-1',
                type: 'MARKETPLACE_PURCHASE',
                tokenAmount: '1750.0000',
                status: 'verified',
                timestamp: '2026-03-29T01:49:41.000Z',
            },
        };

        const rows = buildTransactionCompareRows(transaction, preview);
        const summary = buildTransactionCompareSummary(rows, transaction, preview);

        expect(rows).toHaveLength(8);
        expect(rows.every((row) => row.available)).toBe(true);
        expect(summary.comparable).toBe(8);
        expect(summary.matched).toBe(8);
        expect(summary.mismatched).toBe(0);
        expect(summary.payloadSource).toBe('stored');
        expect(summary.isVerified).toBe(true);
    });
});
