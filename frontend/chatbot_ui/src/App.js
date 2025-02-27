import React, { useState, useEffect } from 'react';
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
} from 'react-router-dom';
import AppLayout from './AppLayout';
import LoginPage from './LoginPage';
import ConversationManagement from './ConversationManagement';
import ApiService from './ApiService';

function App() {
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkToken = async () => {
      if (token) {
        try {
          await ApiService.fetchUserData(); // 验证 token 是否有效
          setIsLoading(false);
        } catch (error) {
          console.error('Token invalid:', error);
          setToken(null);
          localStorage.removeItem('token');
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    };

    checkToken();
  }, [token]);

  const handleLogin = newToken => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
  };

  if (isLoading) {
    return <div>Loading...</div>; // 或者使用一个加载指示器组件
  }

  return (
    <Router>
      <Routes>
        <Route
          path="/login"
          element={
            !token ? (
              <LoginPage onLogin={handleLogin} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route path="/embed" element={<EmbedPage />} />
        <Route
          path="/*"
          element={token ? <AppLayout /> : <Navigate to="/login" replace />}
        />
      </Routes>
    </Router>
  );
}

export default App;
