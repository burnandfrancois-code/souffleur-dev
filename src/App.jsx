import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

// Lazy load all pages
const Landing = lazy(() => import('@/pages/Landing'));
const PlatformSelect = lazy(() => import('@/pages/PlatformSelect'));
const CompleteProfile = lazy(() => import('@/pages/CompleteProfile'));
const Settings = lazy(() => import('@/pages/Settings'));
const DesktopHome = lazy(() => import('@/pages/desktop/Home'));
const DesktopRehearsal = lazy(() => import('@/pages/desktop/Rehearsal'));
const DesktopMyScripts = lazy(() => import('@/pages/desktop/MyScripts'));
const DesktopTarifs = lazy(() => import('@/pages/desktop/Tarifs'));
const AndroidHome = lazy(() => import('@/pages/android/Home'));
const AndroidRehearsal = lazy(() => import('@/pages/android/Rehearsal'));
const AndroidMyScripts = lazy(() => import('@/pages/android/MyScripts'));
const AndroidTarifs = lazy(() => import('@/pages/android/Tarifs'));
const RehearsalTest = lazy(() => import('@/pages/RehearsalTest'));
const AndroidTTSTest = lazy(() => import('@/pages/AndroidTTSTest'));

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Suspense fallback={<div className="fixed inset-0 flex items-center justify-center"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div></div>}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/platform" element={<PlatformSelect />} />
        <Route path="/complete-profile" element={<CompleteProfile />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/desktop/" element={<DesktopHome />} />
        <Route path="/desktop/rehearsal" element={<DesktopRehearsal />} />
        <Route path="/desktop/my-scripts" element={<DesktopMyScripts />} />
        <Route path="/desktop/tarifs" element={<DesktopTarifs />} />
        <Route path="/android/" element={<AndroidHome />} />
        <Route path="/android/rehearsal" element={<AndroidRehearsal />} />
        <Route path="/android/my-scripts" element={<AndroidMyScripts />} />
        <Route path="/android/tarifs" element={<AndroidTarifs />} />
        <Route path="/rehearsal-test" element={<RehearsalTest />} />
        <Route path="/android-tts-test" element={<AndroidTTSTest />} />
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Suspense>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App