import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../pages/auth/LoginPage';

const mockDispatch = jest.fn();
const mockSelector = jest.fn();
const mockLogin = jest.fn((payload, callback) => ({ type: 'LOGIN', payload, callback }));
const mockValidateAuth = jest.fn(() => ({ type: 'VALIDATE_AUTH' }));

jest.mock('react-redux', () => ({
    useDispatch: () => mockDispatch,
    useSelector: (selector) => mockSelector(selector),
}));

jest.mock('../store/auth/auth.action', () => ({
    login: (...args) => mockLogin(...args),
    validateAuth: (...args) => mockValidateAuth(...args),
}));

describe('LoginPage integration', () => {
    beforeEach(() => {
        mockDispatch.mockClear();
        mockLogin.mockClear();
        mockValidateAuth.mockClear();
        mockSelector.mockImplementation((selector) => selector({ auth: { loading: false } }));
    });

    test('validates auth on mount and dispatches login with entered credentials', () => {
        render(
            <MemoryRouter>
                <LoginPage />
            </MemoryRouter>
        );

        expect(mockValidateAuth).toHaveBeenCalledTimes(1);
        expect(mockDispatch).toHaveBeenCalledWith({ type: 'VALIDATE_AUTH' });

        fireEvent.change(screen.getByLabelText(/Email or Username/i), {
            target: { value: 'user@example.com' },
        });
        fireEvent.change(screen.getByLabelText(/Password/i), {
            target: { value: 'secret123' },
        });

        fireEvent.click(screen.getByRole('button', { name: /log in/i }));

        expect(mockLogin).toHaveBeenCalledTimes(1);
        expect(mockLogin.mock.calls[0][0]).toEqual({
            email: 'user@example.com',
            password: 'secret123',
        });
        expect(typeof mockLogin.mock.calls[0][1]).toBe('function');
        expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({
            type: 'LOGIN',
            payload: { email: 'user@example.com', password: 'secret123' },
        }));
    });
});
