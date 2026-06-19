import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { BuilderPage } from './pages/BuilderPage';
import { SettingsPage } from './pages/SettingsPage';
import { QuotationsPage } from './pages/QuotationsPage';
import { AdminPage } from './pages/AdminPage';
import { SharePage } from './pages/SharePage';
import { PrivateRoute } from './components/layout/PrivateRoute';

import { useEffect } from 'react';
import { useStore } from './store/useStore';

function App() {
  const { fetchCurrentUser } = useStore();

  useEffect(() => {
    if (localStorage.getItem('access_token')) {
      fetchCurrentUser();
    }
  }, [fetchCurrentUser]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        
        {/* Public client portal — no auth required, uses token param */}
        <Route path="/share/:id" element={<SharePage />} />

        {/* Protected routes — require authentication */}
        <Route path="/dashboard" element={
          <PrivateRoute>
            <DashboardPage />
          </PrivateRoute>
        } />
        <Route path="/quotations" element={
          <PrivateRoute>
            <QuotationsPage />
          </PrivateRoute>
        } />
        <Route path="/builder" element={
          <PrivateRoute>
            <BuilderPage />
          </PrivateRoute>
        } />
        <Route path="/settings" element={
          <PrivateRoute>
            <SettingsPage />
          </PrivateRoute>
        } />
        {/* Admin route — requires Admin role */}
        <Route path="/admin" element={
          <PrivateRoute requiredRole="Admin">
            <AdminPage />
          </PrivateRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
