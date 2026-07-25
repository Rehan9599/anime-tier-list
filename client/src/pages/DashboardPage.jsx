import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import FriendsSidebar from '../components/FriendsSidebar';

// Only anime is wired up for now. Adding movies/books later is just
// flipping `active: true` here once their API routes exist -- the tier
// board and autosave code underneath don't change.
const CATEGORIES = [
  { key: 'anime', label: 'Anime', active: true, to: '/tierlist', blurb: 'Rank your favorites, S to C.' },
  { key: 'movie', label: 'Movies', active: false, blurb: 'Coming soon.' },
  { key: 'book', label: 'Books', active: false, blurb: 'Coming soon.' },
];

const TIER_KEYS = ['S', 'A', 'B', 'C'];

const DashboardPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const [stats, setStats] = useState({ ranked: 0, sTier: 0, friends: 0 });
  const [friendsTab, setFriendsTab] = useState('friends'); // 'friends' | 'add' | 'requests'
  const [chatFriend, setChatFriend] = useState(null); // null = list view, else = chat thread view
  const [pendingCount, setPendingCount] = useState(0);

  const refreshPendingCount = () => {
    axiosClient.get('/api/friends/requests').then((res) => setPendingCount(res.data.requests.length));
  };

  useEffect(() => {
    Promise.all([
      axiosClient.get('/api/tierlist?category=anime'),
      axiosClient.get('/api/friends'),
    ]).then(([tierRes, friendsRes]) => {
      const tiers = tierRes.data.tierList.tiers;
      const ranked = TIER_KEYS.reduce((sum, t) => sum + tiers[t].length, 0);
      setStats({ ranked, sTier: tiers.S.length, friends: friendsRes.data.friends.length });
    });
    refreshPendingCount();
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const displayName = user?.username || user?.email?.split('@')[0] || 'Profile';
  const avatarLabel = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <div className="tier-page">
      <header className="tier-topbar">
        <div className="tier-brand">
          <div className="tier-brand-mark">◎</div>
          <div className="tier-brand-copy">
            <h1 className="tier-brand-title">Tier List Hub</h1>
            <p className="tier-brand-subtitle">Your rankings, your rules.</p>
          </div>
        </div>

        <div className="tier-topbar-actions">
          <button
            type="button"
            className="tier-notif-bell"
            onClick={() => {
              setChatFriend(null);
              setFriendsTab('requests');
            }}
            aria-label="Friend requests"
          >
            🔔
            {pendingCount > 0 && <span className="tier-notif-badge">{pendingCount}</span>}
          </button>

          <div className="tier-profile">
            <button
              type="button"
              onClick={() => setProfileOpen((open) => !open)}
              className="tier-profile-button"
              aria-haspopup="menu"
              aria-expanded={profileOpen}
            >
              <span className="tier-avatar">{avatarLabel || 'U'}</span>
              <span className="tier-toggle-icon" aria-hidden="true">☰</span>
            </button>

            {profileOpen && (
              <div className="tier-menu" role="menu">
                <p className="tier-menu-greeting">Hi! {user?.username}</p>
                <button
                  type="button"
                  className="tier-menu-item tier-menu-item--danger"
                  onClick={async () => {
                    setProfileOpen(false);
                    await handleLogout();
                  }}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="dash-layout">
        <main className="dash-main">
          <section className="dash-hero">
            <h2 className="dash-hero-title">Welcome back, {user?.username}</h2>
            <p className="dash-hero-subtitle">Here's where things stand.</p>

            <div className="dash-stats">
              <div className="dash-stat-card">
                <span className="dash-stat-value">{stats.ranked}</span>
                <span className="dash-stat-label">Anime ranked</span>
              </div>
              <div className="dash-stat-card">
                <span className="dash-stat-value">{stats.sTier}</span>
                <span className="dash-stat-label">S-tier picks</span>
              </div>
              <div className="dash-stat-card">
                <span className="dash-stat-value">{stats.friends}</span>
                <span className="dash-stat-label">Friends</span>
              </div>
            </div>
          </section>

          <section className="dash-categories">
            <h3 className="dash-section-title">Categories</h3>
            <div className="dash-category-grid">
              {CATEGORIES.map((c) =>
                c.active ? (
                  <Link key={c.key} to={c.to} className="dash-category-card">
                    <span className="dash-category-label">{c.label}</span>
                    <span className="tier-muted">{c.blurb}</span>
                  </Link>
                ) : (
                  <div key={c.key} className="dash-category-card dash-category-card--disabled">
                    <span className="dash-category-label">{c.label}</span>
                    <span className="tier-muted">{c.blurb}</span>
                  </div>
                )
              )}
            </div>
          </section>
        </main>

        <FriendsSidebar
          tab={friendsTab}
          onTabChange={setFriendsTab}
          chatFriend={chatFriend}
          onOpenChat={(friend) => setChatFriend(friend)}
          onCloseChat={() => setChatFriend(null)}
          onRequestsChanged={refreshPendingCount}
          myUserId={user?.id}
        />
      </div>
    </div>
  );
};

export default DashboardPage;
