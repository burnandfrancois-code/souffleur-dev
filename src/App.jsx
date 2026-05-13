import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ProtectedRoute from '@/components/ProtectedRoute';
import Landing from '@/pages/Landing';
import PlatformSelect from '@/pages/PlatformSelect';
import CompleteProfile from '@/pages/CompleteProfile';
import Settings from '@/pages/Settings';
import DesktopRehearsal from '@/pages/desktop/Rehearsal';
import AndroidRehearsal from '@/pages/android/Rehearsal';
import GitHubPRs from '@/pages/GitHubPRs';
import ImportGitHubIssues from '@/pages/ImportGitHubIssues';



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
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/platform" element={<PlatformSelect />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/complete-profile" element={<CompleteProfile />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/desktop/rehearsal" element={<DesktopRehearsal />} />
        <Route path="/android/rehearsal" element={<AndroidRehearsal />} />
        <Route path="/github-prs" element={<GitHubPRs />} />
        <Route path="/import-github-issues" element={<ImportGitHubIssues />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
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