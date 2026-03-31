import { combineReducers, createStore, applyMiddleware } from "redux";
import thunkMiddleware from "redux-thunk";
import { persistStore, persistReducer } from 'redux-persist'
import storage from 'redux-persist/lib/storage' // defaults to localStorage for web
import AuthReducer from "./auth/auth.reducer";
import MemberReducer from "./member/member.reducer";

const persistConfig = {
    key: 'root',
    storage,
}

const rootReducer = combineReducers({
    auth: AuthReducer,
    member:MemberReducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer)

const store = createStore(persistedReducer, applyMiddleware(thunkMiddleware));

store.propTypes = {
    auth: AuthReducer,
    member:MemberReducer,
};

export  {store}

