import { toSafeNumber } from './formatters';

export const calculateQuotaStatus = ({ tokenBalance, quotaRequired }) => {
    const balance = toSafeNumber(tokenBalance);
    const quota = toSafeNumber(quotaRequired);
    const quotaPercentRaw = quota > 0 ? (balance / quota) * 100 : 100;
    const quotaPct = Math.min(100, quotaPercentRaw);
    const quotaMet = balance >= quota;

    return {
        tokenBalance: balance,
        quotaRequired: quota,
        quotaPercentRaw,
        quotaPct,
        quotaMet,
        shortfall: Math.max(0, quota - balance),
    };
};
