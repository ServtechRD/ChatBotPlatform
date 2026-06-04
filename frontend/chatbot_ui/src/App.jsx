import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
} from 'react-router-dom';
import AppLayout from './components/AppLayout';
import LoginPage from './pages/LoginPage';
import EmbedPage from './pages/EmbedPage';
import ConversationManagement from './feature/chat/ConversationManagement';
import KnowledgeBaseLayout from './feature/knowledge/KnowledgeBaseLayout';
import KnowledgeNewPage from './feature/knowledge/KnowledgeNewPage';
import KnowledgeExistingPage from './feature/knowledge/KnowledgeExistingPage';
import KnowledgeSpeechCorrectionPage from './feature/knowledge/KnowledgeSpeechCorrectionPage';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import useAuth from './hook/useAuth';
import { queryClient } from './queries/queryClient';

function AppRoutes() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={!isAuthenticated ? <LoginPage /> : <Navigate to="/" replace />}
      />
      <Route path="/embed" element={<EmbedPage />} />
      <Route
        path="/"
        element={
          isAuthenticated ? <AppLayout /> : <Navigate to="/login" replace />
        }
      >
        <Route index element={<ConversationManagement />} />
        <Route path="knowledge-base" element={<KnowledgeBaseLayout />}>
          <Route index element={<Navigate to="new" replace relative="path" />} />
          <Route path="new" element={<KnowledgeNewPage />} />
          <Route path="existing" element={<KnowledgeExistingPage />} />
          <Route
            path="speech-correction"
            element={<KnowledgeSpeechCorrectionPage />}
          />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <AppRoutes />
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}
