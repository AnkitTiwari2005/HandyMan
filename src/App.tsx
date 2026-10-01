import { useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { useAuthStore } from './stores/authStore';

// Guards
import { ProtectedRoute, PublicRoute } from './components/ProtectedRoute';

// Pages
import Splash from './pages/Splash';
import Onboarding from './pages/Onboarding';
import Login from './pages/Login';
import Signup from './pages/Signup';
import KycSetup from './pages/KycSetup';
import KycPending from './pages/KycPending';
import Dashboard from './pages/Dashboard';
import JobDetail from './pages/JobDetail';
import Schedule from './pages/Schedule';
import Wallet from './pages/Wallet';
import Profile from './pages/Profile';
import Notifications from './pages/Notifications';

export default function App() {
  const { setUser, fetchProfiles, setLoading } = useAuthStore();

  useEffect(() => {
    // One listener handles everything (INITIAL_SESSION fires on startup), so we
    // no longer call getSession() AND fetch again from here and from Login.
    // Never await other Supabase calls inside this callback (deadlock risk):
    // defer them with setTimeout.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user);
        if (event === 'TOKEN_REFRESHED') return; // nothing to reload
        setTimeout(() => { void fetchProfiles(session.user.id); }, 0);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [setUser, fetchProfiles, setLoading]);

  return (
    <Router>
      <Routes>
        {/* Splash & First Launch */}
        <Route path="/splash" element={<Splash />} />

        {/* Public Auth Routes */}
        <Route element={<PublicRoute />}>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
        </Route>

        {/* KYC & Onboarding Config */}
        <Route path="/kyc" element={<KycSetup />} />
        <Route path="/kyc-pending" element={<KycPending />} />

        {/* Protected Partner Routes (With Navbar, BottomNav & Incoming Job Modal) */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/job/:id" element={<JobDetail />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/wallet" element={<Wallet />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/notifications" element={<Notifications />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/splash" replace />} />
      </Routes>
    </Router>
  );
}
