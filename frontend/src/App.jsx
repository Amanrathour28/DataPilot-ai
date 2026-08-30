import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from './components/ui/Toast'
import ErrorBoundary from './components/ui/ErrorBoundary'

// Layout
import AppLayout from './components/layout/AppLayout'

// Auth pages
import Login          from './pages/auth/Login'
import Register       from './pages/auth/Register'
import ForgotPassword from './pages/auth/ForgotPassword'
import ResetPassword  from './pages/auth/ResetPassword'
import Landing        from './pages/Landing'

// App pages
import Dashboard      from './pages/dashboard/Dashboard'
import Datasets       from './pages/datasets/Datasets'
import DatasetDetail  from './pages/datasets/DatasetDetail'
import Investigations from './pages/investigations/Investigations'
import NewInvestigation from './pages/investigations/NewInvestigation'
import InvestigationDetail from './pages/investigations/InvestigationDetail'

import Knowledge from './pages/knowledge/Knowledge'
import Agents from './pages/agents/Agents'
import Analytics from './pages/analytics/Analytics'
import Memory from './pages/memory/Memory'
import SettingsPage from './pages/settings/SettingsPage'
import TeamPage from './pages/team/TeamPage'
import AuditLogsPage from './pages/audit/AuditLogsPage'
import AcceptInvitation from './pages/auth/AcceptInvitation'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

export default function App() {
  return (
    <ErrorBoundary title="Application Error">
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/"                element={<ErrorBoundary><Landing /></ErrorBoundary>} />
              <Route path="/login"           element={<ErrorBoundary><Login /></ErrorBoundary>} />
              <Route path="/register"        element={<ErrorBoundary><Register /></ErrorBoundary>} />
              <Route path="/forgot-password" element={<ErrorBoundary><ForgotPassword /></ErrorBoundary>} />
              <Route path="/reset-password"  element={<ErrorBoundary><ResetPassword /></ErrorBoundary>} />
              <Route path="/invite/:token"   element={<ErrorBoundary><AcceptInvitation /></ErrorBoundary>} />

              {/* Protected app routes */}
              <Route element={<AppLayout />}>
                <Route path="/dashboard"          element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
                <Route path="/investigations"     element={<ErrorBoundary><Investigations /></ErrorBoundary>} />
                <Route path="/investigations/new" element={<ErrorBoundary><NewInvestigation /></ErrorBoundary>} />
                <Route path="/investigations/:id" element={<ErrorBoundary><InvestigationDetail /></ErrorBoundary>} />
                <Route path="/datasets"           element={<ErrorBoundary title="Datasets Error"><Datasets /></ErrorBoundary>} />
                <Route path="/datasets/:id"       element={<ErrorBoundary title="Dataset Explorer Error"><DatasetDetail /></ErrorBoundary>} />
                <Route path="/knowledge"          element={<ErrorBoundary><Knowledge /></ErrorBoundary>} />
                <Route path="/agents"             element={<ErrorBoundary><Agents /></ErrorBoundary>} />
                <Route path="/analytics"          element={<ErrorBoundary><Analytics /></ErrorBoundary>} />
                <Route path="/memory"             element={<ErrorBoundary><Memory /></ErrorBoundary>} />
                <Route path="/team"               element={<ErrorBoundary><TeamPage /></ErrorBoundary>} />
                <Route path="/audit-logs"         element={<ErrorBoundary><AuditLogsPage /></ErrorBoundary>} />
                <Route path="/settings"           element={<ErrorBoundary><SettingsPage /></ErrorBoundary>} />
              </Route>

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
