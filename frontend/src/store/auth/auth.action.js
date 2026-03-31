import axios from "../../core/data_connecter/axios";
import { authAction } from "./auth.reducer";
import { notification } from "antd";
import Api from "../../core/data_connecter/api";
import Key from "../../global/key";

function storeSession(response) {
    const token = response?.data?.token;
    const user = response?.data?.user || {};
    const userRef = user?.credId || user?._id || user?.id || user?.email;
    const userRole = user?.role || user?.userRole || user?.type || '';

    if (token) {
        localStorage.setItem(Key.TOKEN, token);
        axios.defaults.headers.common.Authorization = `Bearer ${token}`;
    }
    if (userRef) {
        localStorage.setItem(Key.UserId, userRef);
    }
    if (user?.email) {
        localStorage.setItem(Key.UserEmail, user.email);
    }
    if (userRole) {
        localStorage.setItem(Key.UserRole, String(userRole));
    }
}

function clearSession() {
    localStorage.removeItem(Key.TOKEN);
    localStorage.removeItem(Key.UserId);
    localStorage.removeItem(Key.UserEmail);
    localStorage.removeItem(Key.UserRole);
    delete axios.defaults.headers.common.Authorization;
}

// LOGIN
export const loginLoading = () => ({
    type: authAction.LOGIN_LOADING,
});

export const loginSuccess = (data, cb) => {
    storeSession(data);
    notification.success({
        message: "Login successful",
    });

    if (cb) {
        cb(data);
    }

    return {
        type: authAction.LOGIN_SUCCESS,
        data,
    };
};

export const loginFailed = (error) => {
    notification.error({
        message: "Login failed",
        description: error?.data?.error || error?.statusText || "Please check your email and password.",
    });

    return {
        type: authAction.LOGIN_FAILED,
        error,
    };
};

export const login = (data, cb) => {
    return (dispatch) => {
        dispatch(loginLoading());
        axios
            .post(`${Api.AUTH_LOGIN}`, data)
            .then((response) => {
                dispatch(loginSuccess(response, cb));
            })
            .catch((error) => {
                dispatch(loginFailed(error?.response));
            });
    };
};

// VALIDATE AUTH
export const validateAuthLoading = () => ({
    type: authAction.VALIDATE_AUTH_LOADING,
});

export const validateAuthSuccess = () => ({
    type: authAction.VALIDATE_AUTH_SUCCESS,
});

export const validateAuthFailed = () => {
    clearSession();
    return {
        type: authAction.VALIDATE_AUTH_FAILED,
    };
};

export const validateAuth = () => {
    const token = localStorage.getItem(Key.TOKEN);
    return (dispatch) => {
        dispatch(validateAuthLoading());
        if (token) {
            axios.defaults.headers.common.Authorization = `Bearer ${token}`;
            dispatch(validateAuthSuccess());
        } else {
            dispatch(validateAuthFailed());
        }
    };
};

// REGISTER
export const registerLoading = () => ({
    type: authAction.REGISTER_LOADING,
});

export const registerSuccess = (data, cb) => {
    if (cb) {
        cb(data);
    }
    return {
        type: authAction.REGISTER_SUCCESS,
        data,
    };
};

export const registerFailed = (error) => {
    notification.error({
        message: "Register failed",
        description: error?.data?.error || error?.statusText || "Unable to create account.",
    });
    return {
        type: authAction.REGISTER_FAILED,
        error,
    };
};

export const register = (data, cb) => {
    return (dispatch) => {
        dispatch(registerLoading());
        axios
            .post(`${Api.AUTH_REGISTER}`, data)
            .then((response) => {
                dispatch(registerSuccess(response, cb));
            })
            .catch((error) => {
                dispatch(registerFailed(error?.response));
            });
    };
};

// LOGOUT
export const Logout = () => {
    clearSession();
    notification.success({
        message: "Logged out",
    });
    return {
        type: authAction.LOGOUT_AUTH,
    };
};
