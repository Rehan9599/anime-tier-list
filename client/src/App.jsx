import { Routes, Route } from 'react-router-dom';
import SignupPage from './pages/SignupPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import TierBoardPage from './pages/TierBoardPage.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import FriendTierListPage from './pages/FriendTierListPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';

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
      <Route path="*" element={
        <ProtectedRoute>
          <DashboardPage />
        </ProtectedRoute>}
      />
      <Route
        path="/friend/:friendId"
        element={
          <ProtectedRoute>
            <FriendTierListPage />
          </ProtectedRoute>
        }
      />
      <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
    </Routes>
  );
}

export default App;
