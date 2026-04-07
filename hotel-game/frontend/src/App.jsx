import { Routes, Route } from 'react-router-dom'
import { PublicRoute, ProtectedRoute } from './components/RouteGuards'
import LandingPage from './pages/LandingPage'

// Placeholder pages — will be replaced in Phases 2-7
function ComingSoon({ title }) {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="bg-surface-bright rounded-xl p-8 clay-card-shadow border-t-4 border-l-4 border-white text-center">
        <h1 className="font-headline text-2xl font-extrabold text-primary mb-2">{title}</h1>
        <p className="font-body text-on-surface-variant">Coming soon...</p>
      </div>
    </div>
  )
}

function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route
        path="/"
        element={
          <PublicRoute>
            <LandingPage />
          </PublicRoute>
        }
      />

      {/* Protected routes — placeholders for Phases 3-7 */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <ComingSoon title="Teacher Dashboard" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student-dashboard"
        element={
          <ProtectedRoute>
            <ComingSoon title="Student Dashboard" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/session/:sessionId/lobby"
        element={
          <ProtectedRoute>
            <ComingSoon title="Lobby" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/session/:sessionId/game"
        element={
          <ProtectedRoute>
            <ComingSoon title="Game" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/session/:sessionId/results"
        element={
          <ProtectedRoute>
            <ComingSoon title="Results" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/session/:sessionId/insights"
        element={
          <ProtectedRoute>
            <ComingSoon title="Insights" />
          </ProtectedRoute>
        }
      />

      {/* Catch-all */}
      <Route path="*" element={<ComingSoon title="404 — Page Not Found" />} />
    </Routes>
  )
}

export default App
