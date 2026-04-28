import { getStoredMemberFallback, getStoredRoleName, normalizeRoleName } from '../utils/authSession';

const createStorage = (values = {}) => ({
    getItem: (key) => values[key] ?? null,
});

describe('authSession helpers', () => {
    test('normalizeRoleName supports string and object roles', () => {
        expect(normalizeRoleName({ role: 'user' })).toBe('USER');
        expect(normalizeRoleName({ role: { role_admin: true } })).toBe('ADMIN');
        expect(normalizeRoleName({ role: { role_consumer: true } })).toBe('USER');
    });

    test('getStoredRoleName reads and normalizes role from storage', () => {
        const storage = createStorage({ UserRole: 'consumer' });
        expect(getStoredRoleName(storage, 'UserRole')).toBe('CONSUMER');
    });

    test('getStoredMemberFallback builds a safe fallback member', () => {
        const storage = createStorage({
            UserRole: 'USER',
            UserEmail: 'demo@nida.ac.th',
        });

        expect(getStoredMemberFallback(storage, { UserRole: 'UserRole', UserEmail: 'UserEmail' })).toEqual({
            name: 'User',
            role: 'USER',
            email: 'demo@nida.ac.th',
        });
    });
});
