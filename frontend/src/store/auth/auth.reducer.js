export const authAction = {
    LOGIN_LOADING: "LOGIN_LOADING",
    LOGIN_SUCCESS: "LOGIN_SUCCESS",
    LOGIN_FAILED: "LOGIN_FAILED",

    ALREADY_LOGIN: "ALREADY_LOGIN",
    NOT_LOGIN: "NOT_LOGIN",
    LOGOUT: "LOGOUT",

    LOGOUT_AUTH: "LOGOUT_AUTH",

    REGISTER_LOADING: "REGISTER_LOADING",
    REGISTER_SUCCESS: "REGISTER_SUCCESS",
    REGISTER_FAILED: "REGISTER_FAILED",

    VALIDATE_AUTH_LOADING: "VALIDATE_AUTH_LOADING",
    VALIDATE_AUTH_SUCCESS: "VALIDATE_AUTH_SUCCESS",
    VALIDATE_AUTH_FAILED: "VALIDATE_AUTH_FAILED",
};

// Reducer
const initialState = {};
const reducer = (state = initialState, action = {}) => {
    switch (action.type) {
        case authAction.LOGIN_LOADING:
            return {
                ...state,
                loading: true,
                error: undefined,
                isAuthenticate: false,
            };
        case authAction.LOGIN_SUCCESS:
            return {
                ...state,
                loading: false,
                error: undefined,
                isAuthenticate: false,
                user: action.data,
                otpStatus: "login",
            };
        case authAction.LOGIN_FAILED:
            return {
                ...state,
                loading: false,
                error: action.error,
                errorCode: action.errorCode,
                isAuthenticate: false,
                user: undefined,
            };
        case authAction.ALREADY_LOGIN:
            return {
                error: undefined,
                isAuthenticate: true,
            };
        case authAction.NOT_LOGIN:
            return {
                error: undefined,
                isAuthenticate: false,
            };
        case authAction.LOGOUT:
            return {
                error: undefined,
                isAuthenticate: false,
            };
        //REGISTER
        case authAction.REGISTER_LOADING:
            return {
                ...state,
                loading: true,
                error: undefined,
            };
        case authAction.REGISTER_SUCCESS:
            return {
                ...state,
                loading: false,
                error: undefined,
                otpStatus: "register",
            };
        case authAction.REGISTER_FAILED:
            return {
                ...state,
                loading: false,
                error: action.error,
                errorCode: action.errorCode,
            };

        //VALIDATE AUTH
        case authAction.VALIDATE_AUTH_LOADING:
            return {
                ...state,
                loading: true,
                isAuthenticate: false,
            };
        case authAction.VALIDATE_AUTH_SUCCESS:
            return {
                ...state,
                loading: false,
                isAuthenticate: true,
            };
        case authAction.VALIDATE_AUTH_FAILED:
            return {
                ...state,
                loading: false,
                isAuthenticate: false,
            };
        //LOGOUT AUTH
        case authAction.LOGOUT_AUTH:
            return {
                ...state,
                isAuthenticate: false,
            };
        default:
            return state;
    }
};

export default reducer;
