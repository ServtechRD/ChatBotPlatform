import React, { useState, useEffect } from 'react';
import AppLayout from './AppLayout';
import LoginPage from './LoginPage';
import ConversationManagement from './ConversationManagement';

function App() {
  const [token, setToken] = useState(null);

  useEffect(() => {
    // 在組件掛載時檢查本地存儲中是否有 token
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  const handleLogin = newToken => {
    // 登入成功後設置 token
    localStorage.setItem('token', newToken);
    setToken(newToken);
  };

  const handleLogout = () => {
    // 登出時清除 token
    localStorage.removeItem('token');
    setToken(null);
  };

  if (!token) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <AppLayout token={token} onLogout={handleLogout}>
      <ConversationManagement />
    </AppLayout>
  );
}

export default App;
