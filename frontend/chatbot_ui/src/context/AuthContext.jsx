import { createContext, useState, useEffect } from 'react';
import { auth } from '../api/auth.js';
import { user as userApi } from '../api/user.js';
import { storage } from '../api/storage.js';
import { speechCorrectionRulesStore } from '../store/speechCorrectionRulesStore';
import { queryClient } from '../queries/queryClient';
import { userKeys } from '../queries/user';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      auth.get()
        .then(userData => {
          setIsAuthenticated(true);
          setUser(userData);
        })
        .catch(() => {
          storage.clearAuthData();
          setIsAuthenticated(false);
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  async function login(token) {
    localStorage.setItem('token', token);
    setIsAuthenticated(true);
    const userData = await auth.get();
    setUser(userData);
    const userId = storage.getUserId();
    await queryClient.fetchQuery({
      queryKey: userKeys.assistants(userId),
      queryFn: () => userApi.getAssistants(),
    });
  }

  function logout() {
    storage.clearAuthData();
    speechCorrectionRulesStore.resetSpeechCorrectionRulesStore();
    setIsAuthenticated(false);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
