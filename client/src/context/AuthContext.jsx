import { createContext, useContext, useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Session lives in an httpOnly cookie, so we just ask the API who we are
  // on mount rather than storing anything ourselves.
  useEffect(() => {
    axiosClient
      .get('/api/auth/me')
      .then((res) => setUser(res.data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const signup = async (payload) => {
    const res = await axiosClient.post('/api/auth/signup', payload);
    setUser(res.data.user);
  };

  const login = async (payload) => {
    const res = await axiosClient.post('/api/auth/login', payload);
    setUser(res.data.user);
  };

  const logout = async () => {
    await axiosClient.post('/api/auth/logout');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signup, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
