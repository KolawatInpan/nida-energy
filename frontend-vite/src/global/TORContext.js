import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const TORContext = createContext({ showTOR: false, setShowTOR: () => {} });
export const TOR_REQUIREMENT_STORAGE_KEY = 'nida-tor-requirement-enabled';

function getStoredTorRequirement() {
    try {
        return localStorage.getItem(TOR_REQUIREMENT_STORAGE_KEY) === 'true';
    } catch (error) {
        return false;
    }
}

export const useTOR = () => useContext(TORContext);

export const TORProvider = ({ children }) => {
    const [showTOR, setShowTOR] = useState(getStoredTorRequirement);

    useEffect(() => {
        try {
            localStorage.setItem(TOR_REQUIREMENT_STORAGE_KEY, String(Boolean(showTOR)));
        } catch (error) {
            // ignore storage failures
        }
    }, [showTOR]);

    const value = useMemo(() => ({ showTOR, setShowTOR }), [showTOR]);

    return (
        <TORContext.Provider value={value}>
            {children}
        </TORContext.Provider>
    );
};
