import { Suspense, lazy } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { PageSkeleton } from './components/ui/PageSkeleton'
import { ProtectedRoute } from './auth/ProtectedRoute'

const LandingPage = lazy(() => import('./pages/LandingPage'))
const AuthPage = lazy(() => import('./pages/AuthPage'))
const ClaimAccessPage = lazy(() => import('./pages/ClaimAccessPage'))
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const AddAssetPage = lazy(() => import('./pages/AddAssetPage'))
const AssetDetailPage = lazy(() => import('./pages/AssetDetailPage'))
const NomineeManagementPage = lazy(() => import('./pages/NomineeManagementPage'))
const SecuritySettingsPage = lazy(() => import('./pages/SecuritySettingsPage'))
const ActivityLogsPage = lazy(() => import('./pages/ActivityLogsPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const HelpPage = lazy(() => import('./pages/HelpPage'))
const AdminPanelPage = lazy(() => import('./pages/AdminPanelPage'))

function App() {
  const location = useLocation()

  return (
    <Suspense fallback={<PageSkeleton />}>
      <AnimatePresence mode="wait">
        <Routes location={location}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/claim-access" element={<ClaimAccessPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route element={<AppShell />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route element={<ProtectedRoute allowedRoles={['user', 'nominee', 'admin']} />}>
                <Route path="/assets/:id" element={<AssetDetailPage />} />
              </Route>
              <Route element={<ProtectedRoute allowedRoles={['user', 'admin']} />}>
                <Route path="/assets/new" element={<AddAssetPage />} />
                <Route path="/security" element={<SecuritySettingsPage />} />
              </Route>
              <Route element={<ProtectedRoute allowedRoles={['user', 'nominee', 'admin']} />}>
                <Route path="/nominees" element={<NomineeManagementPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/help" element={<HelpPage />} />
              </Route>
              <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                <Route path="/admin" element={<AdminPanelPage />} />
                <Route path="/activity" element={<ActivityLogsPage />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </Suspense>
  )
}

export default App
