import { Routes, Route } from 'react-router-dom'
import { PublicRoute, ProtectedRoute } from './components/RouteGuards'
import LandingPage from './pages/LandingPage'
import Dashboard from './pages/Dashboard'
import GamePage from './pages/GamePage'
import ClassicGamePage from './pages/ClassicGamePage'
import ResultsPage from './pages/ResultsPage'
import InsightsPage from './pages/InsightsPage'
import LeaderboardPage from './pages/LeaderboardPage'
import KPIDashboardPage from './pages/KPIDashboardPage'

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

      {/* Protected routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/leaderboard"
        element={
          <ProtectedRoute>
            <LeaderboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/session/:sessionId/game"
        element={
          <ProtectedRoute>
            <GamePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/session/:sessionId/classic"
        element={
          <ProtectedRoute>
            <ClassicGamePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/session/:sessionId/results"
        element={
          <ProtectedRoute>
            <ResultsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/session/:sessionId/insights"
        element={
          <ProtectedRoute>
            <InsightsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/session/:sessionId/kpis"
        element={
          <ProtectedRoute>
            <KPIDashboardPage />
          </ProtectedRoute>
        }
      />

      {/* Catch-all */}
      <Route
        path="*"
        element={
          <div className="min-h-screen bg-surface flex items-center justify-center">
            <div className="bg-surface-bright rounded-xl p-8 clay-card-shadow border-t-4 border-l-4 border-white text-center">
              <h1 className="font-headline text-2xl font-extrabold text-primary mb-2">404 — Page Not Found</h1>
              <p className="font-body text-on-surface-variant">This page doesn't exist.</p>
            </div>
          </div>
        }
      />
    </Routes>
  )
}

export default App
