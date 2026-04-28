export const memberAction = {
    GET_MEMBER_LOADING: "GET_MEMBER_LOADING",
    GET_MEMBER_SUCCESS: "GET_MEMBER_SUCCESS",
    GET_MEMBER_FAILED: "GET_MEMBER_FAILED",

    GET_STAFF_LOADING: "GET_STAFF_LOADING",
    GET_STAFF_SUCCESS: "GET_STAFF_SUCCESS",
    GET_STAFF_FAILED: "GET_STAFF_FAILED",
};

// Reducer
const initialState = { all: [],Staff: [],loading: false };
const reducer = (state = initialState, action = {}) => {
    switch (action.type) {
        case memberAction.GET_MEMBER_LOADING:
            return {
                ...state,
                loading: true,
                error: undefined,
            };
        case memberAction.GET_MEMBER_SUCCESS:
            return {
                ...state,
                all: action.data,
                loading: false,
                error: undefined,
            };
        case memberAction.GET_MEMBER_FAILED:
            return {
                ...state,
                all: [],
                loading: false,
                error: action.error,
            };

        case memberAction.GET_STAFF_LOADING:
            return {
                ...state,
                loading: true,
                error: undefined,
            };
        case memberAction.GET_STAFF_SUCCESS:
            return {
                ...state,
                Staff: action.data,
                loading: false,
                error: undefined,
            };
        case memberAction.GET_STAFF_FAILED:
            return {
                ...state,
                Staff: [],
                loading: false,
                error: action.error,
            };

        default:
            return state;
    }
};

export default reducer;
