import { Navigate, Route, Routes } from "react-router-dom";
import { useEffect } from "react";
import { AppProvider, useApp } from "./context/AppContext";
import DashboardLayout from "./layouts/DashboardLayout";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import DashboardPage from "./pages/DashboardPage";
import CreatePostPage from "./pages/CreatePostPage";
import SchedulePage from "./pages/SchedulePage";
import AnalyticsPage from "./pages/AnalyticsPage";
import SettingsPage from "./pages/SettingsPage";
import ConnectedPlatformsPage from "./pages/ConnectedPlatformsPage";
import OnboardingPlatformsPage from "./pages/OnboardingPlatformsPage";
import Toast from "./components/Toast";

function ProtectedRoute({ children }) {
  const { isAuthed } = useApp();
  return isAuthed ? children : <Navigate to="/login" replace />;
}

function LoginRoute() {
  const { isAuthed, isOnboardingCompleted } = useApp();
  if (!isAuthed) return <LoginPage />;
  return <Navigate to={isOnboardingCompleted ? "/dashboard" : "/onboarding/platforms"} replace />;
}

function SignupRoute() {
  const { isAuthed, isOnboardingCompleted } = useApp();
  if (!isAuthed) return <SignupPage />;
  return <Navigate to={isOnboardingCompleted ? "/dashboard" : "/onboarding/platforms"} replace />;
}

function DashboardGateRoute({ children }) {
  const { isOnboardingCompleted } = useApp();
  return isOnboardingCompleted ? children : <Navigate to="/onboarding/platforms" replace />;
}

function OnboardingRoute() {
  const { isAuthed, isOnboardingCompleted } = useApp();
  if (!isAuthed) return <Navigate to="/login" replace />;
  return isOnboardingCompleted ? <Navigate to="/dashboard" replace /> : <OnboardingPlatformsPage />;
}

function NotFoundRoute() {
  const { isAuthed, isOnboardingCompleted } = useApp();
  if (!isAuthed) return <Navigate to="/login" replace />;
  return <Navigate to={isOnboardingCompleted ? "/dashboard" : "/onboarding/platforms"} replace />;
}

function RootRouter() {
  const { theme } = useApp();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return (
    <>
      <Routes>
        <Route path="/index.html" element={<Navigate to="/" replace />} />
        <Route path="/login.html" element={<Navigate to="/login" replace />} />
        <Route path="/signup.html" element={<Navigate to="/signup" replace />} />
        <Route path="/dashboard.html" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/signup" element={<SignupRoute />} />
        <Route path="/onboarding/platforms" element={<OnboardingRoute />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardGateRoute>
                <DashboardLayout />
              </DashboardGateRoute>
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="create-post" element={<CreatePostPage />} />
          <Route path="schedule" element={<SchedulePage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="connected-platforms" element={<ConnectedPlatformsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<NotFoundRoute />} />
      </Routes>
      <Toast />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <RootRouter />
    </AppProvider>
  );
}
