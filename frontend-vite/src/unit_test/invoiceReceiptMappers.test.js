import { buildReceiptView, formatBillingPeriod, getCustomerType } from '../utils/invoiceReceiptMappers';

describe('invoiceReceiptMappers helpers', () => {
    test('formatBillingPeriod returns month range for invoice period', () => {
        expect(formatBillingPeriod({ month: 3, year: 2026 })).toBe('01 Mar 2026 - 31 Mar 2026');
        expect(formatBillingPeriod(null)).toBe('-');
    });

    test('getCustomerType maps roles to readable labels', () => {
        expect(getCustomerType({ role: 'PROSUMER' })).toBe('Prosumer');
        expect(getCustomerType({ role: 'CONSUMER' })).toBe('Consumer');
        expect(getCustomerType({ role: 'PRODUCER' })).toBe('Producer');
        expect(getCustomerType({ role: 'ADMIN' })).toBe('Administrator');
        expect(getCustomerType({ role: 'UNKNOWN' })).toBe('Institutional');
    });

    test('buildReceiptView maps receipt, invoice, building, and wallet data into receipt view model', () => {
        const view = buildReceiptView({
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
                name: 'Malai',
                address: '118 Seri Thai Rd',
                province: 'Bangkok',
                postal: '10240',
            },
            owner: {
                role: 'PROSUMER',
                email: 'owner@example.com',
            },
            walletTx: {
                id: '88',
            },
        }, '450-21');

        expect(view.receiptId).toBe('450-21');
        expect(view.receiptNumber).toBe('REC-450-21');
        expect(view.invoiceNumber).toBe('INV-450-21');
        expect(view.buildingName).toBe('Malai');
        expect(view.location).toContain('Bangkok');
        expect(view.customerType).toBe('Prosumer');
        expect(view.smartMeterId).toBe('WTX-88');
        expect(view.snid).toBe('BLD-38');
        expect(view.paymentMethod).toBe('NIDA Token Wallet');
        expect(view.status).toBe('PAID');
        expect(view.consumedKwh).toBe(500);
        expect(view.marketDiscountKwh).toBe(100);
        expect(view.billableKwh).toBe(400);
        expect(view.rate).toBeCloseTo(4.375, 3);
        expect(view.gridEnergyCost).toBeCloseTo(2187.5, 1);
        expect(view.discountTokenAmount).toBeCloseTo(437.5, 1);
        expect(view.adminFeeAmount).toBeCloseTo(8.75, 2);
        expect(view.totalPaidWithFee).toBeCloseTo(1758.75, 2);
        expect(view.transactionReference).toBe('tx-55');
    });
});
