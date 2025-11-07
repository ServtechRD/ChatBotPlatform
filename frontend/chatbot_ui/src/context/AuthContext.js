import { createContext, useState, useEffect, useCallback } from 'react';
import ApiService from '../api/ApiService';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      ApiService.fetchUserData()
        .then(() => setIsAuthenticated(true))
        .catch(() => {
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('userData');
          localStorage.removeItem('assistantsData');
          setIsAuthenticated(false);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = token => {
    localStorage.setItem('token', token);
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userData');
    localStorage.removeItem('assistantsData');
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
