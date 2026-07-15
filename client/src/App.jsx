import { Routes, Route } from 'react-router-dom';
import SignupPage from './pages/SignupPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import TierBoardPage from './pages/TierBoardPage.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

function App() {
  return (
    <Routes>
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tierlist"
        element={
          <ProtectedRoute>
            <TierBoardPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<DashboardPage />} />
    </Routes>
  );
}

export default App;
