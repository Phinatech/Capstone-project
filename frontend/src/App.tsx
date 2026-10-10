import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AnimatePresence, MotionConfig } from 'framer-motion';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PolicyProvider } from './contexts/PolicyContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { I18nProvider, useI18n } from './contexts/I18nContext';
import { PreferencesProvider, usePreferences } from './contexts/PreferencesContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { RequireRole, RoleRedirect } from './components/layout/RequireRole';
import { LoadingScreen } from './components/LoadingScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ErrorPage } from './pages/ErrorPage';
import { NotFound } from './pages/NotFound';

const page = <T extends string,>(loader: () => Promise<Record<T, React.ComponentType>>, name: T) =>
lazy(() => loader().then((m) => ({ default: m[name] })));

const SignIn = page(() => import('./pages/SignIn'), 'SignIn');
const SignUp = page(() => import('./pages/SignUp'), 'SignUp');
const ForgotPassword = page(() => import('./pages/auth/ForgotPassword'), 'ForgotPassword');
const ResetPassword = page(() => import('./pages/auth/ResetPassword'), 'ResetPassword');
const VerifyEmail = page(() => import('./pages/auth/VerifyEmail'), 'VerifyEmail');
const AuthCallback = page(() => import('./pages/AuthCallback'), 'AuthCallback');
const Profile = page(() => import('./pages/Profile'), 'Profile');
const Settings = page(() => import('./pages/Settings'), 'Settings');
const Notifications = page(() => import('./pages/Notifications'), 'Notifications');
const FarmerDashboard = page(() => import('./pages/farmer/FarmerDashboard'), 'FarmerDashboard');
const FarmerPolicies = page(() => import('./pages/farmer/FarmerPolicies'), 'FarmerPolicies');
const BuyCover = page(() => import('./pages/farmer/BuyCover'), 'BuyCover');
const FarmerPolicyDetail = page(() => import('./pages/farmer/FarmerPolicyDetail'), 'FarmerPolicyDetail');
const FarmerPayouts = page(() => import('./pages/farmer/FarmerPayouts'), 'FarmerPayouts');
const AdminOverview = page(() => import('./pages/admin/AdminOverview'), 'AdminOverview');
const AdminPolicies = page(() => import('./pages/admin/AdminPolicies'), 'AdminPolicies');
const AdminPolicyDetail = page(() => import('./pages/admin/AdminPolicyDetail'), 'AdminPolicyDetail');
const Farmers = page(() => import('./pages/admin/Farmers'), 'Farmers');
const Oracles = page(() => import('./pages/admin/Oracles'), 'Oracles');
const Analytics = page(() => import('./pages/admin/Analytics'), 'Analytics');
const Backtest = page(() => import('./pages/admin/Backtest'), 'Backtest');
const DataModel = page(() => import('./pages/admin/DataModel'), 'DataModel');
const AgentBuyCover = page(() => import('./pages/agent/AgentBuyCover'), 'AgentBuyCover');

function AppRoutes() {
  const { ready } = useAuth();
  const { resolvedMode } = useTheme();
  const { t } = useI18n();

  return (
    <>
      <AnimatePresence>{!ready && <LoadingScreen label={t('loading.label')} sublabel={t('loading.restoring')} />}</AnimatePresence>
      {ready &&
      <Suspense fallback={<LoadingScreen label={t('loading.label')} />}>
          <Routes>
            <Route path="/" element={<RoleRedirect />} />
            <Route path="/sign-in" element={<SignIn />} />
            <Route path="/sign-up" element={<SignUp />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/error" element={<ErrorPage fullScreen />} />

            <Route
            path="/farmer"
            element={
            <RequireRole role="farmer">
                  <DashboardLayout />
                </RequireRole>
            }>
            
              <Route index element={<FarmerDashboard />} />
              <Route path="policies" element={<FarmerPolicies />} />
              <Route path="policies/new" element={<BuyCover />} />
              <Route path="policies/:policyId" element={<FarmerPolicyDetail />} />
              <Route path="payouts" element={<FarmerPayouts />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="profile" element={<Profile />} />
              <Route path="settings" element={<Settings />} />
              <Route path="*" element={<NotFound />} />
            </Route>

            <Route
            path="/admin"
            element={
            <RequireRole role="admin">
                  <DashboardLayout />
                </RequireRole>
            }>
            
              <Route index element={<AdminOverview />} />
              <Route path="policies" element={<AdminPolicies />} />
              <Route path="policies/:policyId" element={<AdminPolicyDetail />} />
              <Route path="farmers" element={<Farmers />} />
              <Route path="oracles" element={<Oracles />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="backtest" element={<Backtest />} />
              <Route path="data-model" element={<DataModel />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="profile" element={<Profile />} />
              <Route path="settings" element={<Settings />} />
              <Route path="*" element={<NotFound />} />
            </Route>

            <Route
              path="/agent"
              element={
                <RequireRole role="agent">
                  <DashboardLayout />
                </RequireRole>
              }>
              <Route path="policies/new" element={<AgentBuyCover />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="profile" element={<Profile />} />
              <Route path="settings" element={<Settings />} />
              <Route path="*" element={<NotFound />} />
            </Route>

            <Route path="*" element={<NotFound standalone />} />
          </Routes>
        </Suspense>
      }
      <Toaster
        position="top-right"
        theme={resolvedMode}
        closeButton
        offset={76}
        toastOptions={{ style: { fontFamily: 'Inter, sans-serif' } }} />
      
    </>);

}

function Motion({ children }: {children: React.ReactNode;}) {
  const { prefs } = usePreferences();
  return <MotionConfig reducedMotion={prefs.reduceMotion ? 'always' : 'user'}>{children}</MotionConfig>;
}

export function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <PreferencesProvider>
          <Motion>
            <ErrorBoundary fullScreen>
              <BrowserRouter>
                <AuthProvider>
                  <NotificationProvider>
                    <PolicyProvider>
                      <AppRoutes />
                    </PolicyProvider>
                  </NotificationProvider>
                </AuthProvider>
              </BrowserRouter>
            </ErrorBoundary>
          </Motion>
        </PreferencesProvider>
      </I18nProvider>
    </ThemeProvider>);

}