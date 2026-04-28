import { calculateQuotaStatus } from '../utils/walletQuota';

describe('walletQuota helpers', () => {
    test('calculateQuotaStatus caps progress at 100 and marks quota met', () => {
        const result = calculateQuotaStatus({ tokenBalance: 5000, quotaRequired: 1828.78 });

        expect(result.quotaMet).toBe(true);
        expect(result.quotaPct).toBe(100);
        expect(result.quotaPercentRaw).toBeGreaterThan(100);
        expect(result.shortfall).toBe(0);
    });

    test('calculateQuotaStatus returns shortfall when quota is not met', () => {
        const result = calculateQuotaStatus({ tokenBalance: 250, quotaRequired: 1000 });

        expect(result.quotaMet).toBe(false);
        expect(result.quotaPct).toBe(25);
        expect(result.shortfall).toBe(750);
    });

    test('calculateQuotaStatus defaults to 100 percent when quota is zero', () => {
        const result = calculateQuotaStatus({ tokenBalance: 0, quotaRequired: 0 });

        expect(result.quotaPercentRaw).toBe(100);
        expect(result.quotaPct).toBe(100);
    });
});
