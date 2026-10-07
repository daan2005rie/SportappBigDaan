import { BrowserRouter, Route, Routes } from 'react-router-dom'

import { AuthProvider } from './auth/AuthContext'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { AppShell } from './components/AppShell'
import { HomePage } from './pages/HomePage'
import { ProgressPage } from './pages/ProgressPage'
import { WorkoutDetailsPage } from './pages/WorkoutDetailsPage'
import { WorkoutHistoryPage } from './pages/WorkoutHistoryPage'
import { WorkoutPage } from './pages/WorkoutPage'
import { AuthPage } from './pages/AuthPage'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
          <Route path="/forgot-password" element={<AuthPage mode="forgot-password" />} />
          <Route path="/reset-password" element={<AuthPage mode="reset-password" />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route index element={<HomePage />} />
              <Route path="workout" element={<WorkoutPage />} />
              <Route path="workouts" element={<WorkoutHistoryPage />} />
              <Route path="workouts/:id" element={<WorkoutDetailsPage />} />
              <Route path="progress" element={<ProgressPage />} />
            </Route>
          </Route>
          <Route path="*" element={<AuthPage mode="login" />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
