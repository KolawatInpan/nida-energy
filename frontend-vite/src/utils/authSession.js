export const normalizeRoleName = (member) => {
    const roleValue = member?.role ?? member?.userRole ?? member?.type ?? null;

    if (typeof roleValue === 'string') {
        return roleValue.toUpperCase();
    }

    if (roleValue && typeof roleValue === 'object') {
        if (roleValue.role_admin || roleValue.admin) return 'ADMIN';
            if (roleValue.role_consumer || roleValue.consumer) return 'USER';
            if (roleValue.role_user || roleValue.user) return 'USER';
            // legacy role flags map to USER
            if (roleValue.role_producer || roleValue.producer) return 'USER';
            if (roleValue.role_battery || roleValue.battery) return 'USER';
        if (roleValue.role_monitor || roleValue.role_booking || roleValue.role_reseption) return 'ADMIN';
    }

        return 'ADMIN';
};

export const getStoredRoleName = (storageLike, roleKey) => {
    const storedRole = storageLike?.getItem ? storageLike.getItem(roleKey) : '';
    return String(storedRole || '').trim().toUpperCase();
};

export const getStoredMemberFallback = (storageLike, keyMap) => ({
    name: 'User',
    role: storageLike?.getItem ? storageLike.getItem(keyMap.UserRole) || 'USER' : 'USER',
    email: storageLike?.getItem ? storageLike.getItem(keyMap.UserEmail) || '' : '',
});
