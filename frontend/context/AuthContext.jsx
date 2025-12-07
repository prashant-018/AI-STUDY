"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi, getAuthToken, saveAuthToken, removeAuthToken } from "../utils/api.js";

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch current user from /api/auth/me
  const getUser = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const token = getAuthToken();
      if (!token) {
        setUser(null);
        setLoading(false);
        return null;
      }

      const data = await authApi.me();
      if (data?.success && data?.user) {
        setUser({
          ...data.user,
          picture: data.user.picture || null
        });
        return data.user;
      }
      setUser(null);
      return null;
    } catch (err) {
      // 401 is expected when not logged in - don't treat as error
      if (err.status === 401) {
        removeAuthToken();
        setUser(null);
        setError(null);
        return null;
      }
      // Only log non-401 errors
      console.error('❌ Auth error:', err.message || 'Failed to fetch user');
      setError(err.message || 'Failed to fetch user');
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Check authentication on mount
  useEffect(() => {
    getUser();
  }, [getUser]);

  const registerUser = useCallback(async (payload) => {
    try {
      setError(null);
      const data = await authApi.register(payload);
      if (data?.success && data?.user) {
        setUser({
          ...data.user,
          picture: data.user.picture || null
        });
        if (data?.token) {
          saveAuthToken(data.token);
        }
      } else {
        throw new Error(data?.message || 'Registration failed');
      }
      return data;
    } catch (err) {
      setError(err.message || 'Registration failed');
      throw err;
    }
  }, []);

  const loginUser = useCallback(async (payload) => {
    try {
      setError(null);
      const data = await authApi.login(payload);
      if (data?.success && data?.user) {
        setUser({
          ...data.user,
          picture: data.user.picture || null
        });
        if (data?.token) {
          saveAuthToken(data.token);
        }
        return data;
      } else {
        throw new Error(data?.message || 'Login failed');
      }
    } catch (err) {
      let errorMessage = 'Login failed';
      if (err.data?.message) {
        errorMessage = err.data.message;
      } else if (err.data?.error) {
        errorMessage = err.data.error;
      } else if (err.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
      throw err;
    }
  }, []);

  const logoutUser = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      removeAuthToken();
      setUser(null);
      setError(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      error,
      registerUser,
      loginUser,
      logoutUser,
      getUser
    }),
    [user, loading, error, registerUser, loginUser, logoutUser, getUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
