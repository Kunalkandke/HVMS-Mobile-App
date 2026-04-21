import React, { createContext, useContext, useReducer, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

const initialState = {
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
};

function authReducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'LOGIN_SUCCESS':
      return { ...state, user: action.payload.user, token: action.payload.token, isAuthenticated: true, isLoading: false };
    case 'LOGOUT':
      return { ...initialState, isLoading: false };
    case 'UPDATE_USER':
      return { ...state, user: { ...state.user, ...action.payload } };
    default:
      return state;
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  useEffect(() => { restoreSession(); }, []);

  const restoreSession = async () => {
    try {
      const token = await SecureStore.getItemAsync('hvms_token');
      const userStr = await SecureStore.getItemAsync('hvms_user');
      if (token && userStr) {
        const user = JSON.parse(userStr);
        const result = await authService.getMe();
        if (result.success) {
          dispatch({ type: 'LOGIN_SUCCESS', payload: { user: result.data, token } });
          return;
        }
      }
    } catch {
      await clearStorage();
    }
    dispatch({ type: 'SET_LOADING', payload: false });
  };

  const login = async (email, password) => {
    try {
      const result = await authService.login(email, password);
      if (result.success) {
        const { token, user } = result.data;
        await SecureStore.setItemAsync('hvms_token', token);
        await SecureStore.setItemAsync('hvms_user', JSON.stringify(user));
        dispatch({ type: 'LOGIN_SUCCESS', payload: { user, token } });
        return { success: true, user };
      }
      return { success: false, message: result.message };
    } catch (error) {
      return { success: false, message: error.message || 'Login failed. Check your connection.' };
    }
  };

  const logout = async () => {
    try { await authService.logout(); } catch {}
    await clearStorage();
    dispatch({ type: 'LOGOUT' });
  };

  const updateUser = (userData) => {
    dispatch({ type: 'UPDATE_USER', payload: userData });
    SecureStore.setItemAsync('hvms_user', JSON.stringify({ ...state.user, ...userData }));
  };

  const clearStorage = async () => {
    await SecureStore.deleteItemAsync('hvms_token').catch(() => {});
    await SecureStore.deleteItemAsync('hvms_user').catch(() => {});
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
