import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import Navbar from './Navbar';
import BottomNav from './BottomNav';
import IncomingJobModal from './IncomingJobModal';

export const ProtectedRoute = () => {
  const { user, profile, technicianProfile, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-orange-500/20 border-t-orange-500 animate-spin" />
        <p className="mt-4 text-xs font-syne text-slate-400 tracking-wider uppercase">Loading Partner Engine...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If user signed up but hasn't configured skills or KYC
  if (!technicianProfile || !technicianProfile.skills || technicianProfile.skills.length === 0) {
    return <Navigate to="/kyc" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col max-w-lg mx-auto border-x border-slate-900 shadow-2xl relative">
      <Navbar />
      <main className="flex-1 pb-safe">
        <Outlet />
      </main>
      <BottomNav />
      <IncomingJobModal />
    </div>
  );
};

export const PublicRoute = () => {
  const { user, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-orange-500/20 border-t-orange-500 animate-spin" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};
