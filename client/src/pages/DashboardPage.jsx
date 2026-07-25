import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MdChatBubbleOutline, MdNotificationsNone, MdLogout, MdClose } from 'react-icons/md';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import FriendsSidebar from '../components/FriendsSidebar';
import Carousel from '../components/Carousel';
import PosterRow from '../components/PosterRow';

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
  const [chatOpen, setChatOpen] = useState(false);
  const [friendsTab, setFriendsTab] = useState('friends'); // 'friends' | 'add' | 'requests'
  const [chatFriend, setChatFriend] = useState(null); // null = list view, else = chat thread view
  const [pendingCount, setPendingCount] = useState(0);

  const [ratedItems, setRatedItems] = useState([]);
  const [trendingItems, setTrendingItems] = useState([]);
  const [highlightItems, setHighlightItems] = useState([]);

  const refreshPendingCount = () => {
    axiosClient.get('/api/friends/requests').then((res) => setPendingCount(res.data.requests.length));
  };

  useEffect(() => {
    axiosClient.get('/api/tierlist?category=anime').then((res) => {
      const tiers = res.data.tierList.tiers;
      const flattened = TIER_KEYS.flatMap((t) =>
        tiers[t].map((a) => ({ id: a.animeId, title: a.title, imageUrl: a.imageUrl, tier: t }))
      );
      setRatedItems(flattened);
    });

    axiosClient.get('/api/anime/trending').then((res) => setTrendingItems(res.data.results));
    axiosClient.get('/api/anime/top?page=1').then((res) => setHighlightItems(res.data.results.slice(0, 8)));

    refreshPendingCount();
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const openChat = (tab) => {
    setChatFriend(null);
    setFriendsTab(tab);
    setChatOpen(true);
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
    <div className={`app-shell ${chatOpen ? 'app-shell--chat-open' : ''}`}>
      <div className="app-main">
        <header className="tier-topbar">
          <div className="tier-brand">
            <div className="tier-brand-mark">◎</div>
            <div className="tier-brand-copy">
              <h1 className="tier-brand-title">Tier List Hub</h1>
              <p className="tier-brand-subtitle">Your rankings, your rules.</p>
            </div>
          </div>

          <div className="tier-topbar-actions">
            <button type="button" className="tier-icon-btn" onClick={() => openChat('friends')} aria-label="Chat">
              <MdChatBubbleOutline size={20} />
            </button>

            <button type="button" className="tier-icon-btn" onClick={() => openChat('requests')} aria-label="Notifications">
              <MdNotificationsNone size={20} />
              {pendingCount > 0 && <span className="tier-notif-badge">{pendingCount}</span>}
            </button>

            <div className="tier-profile">
              <button
                type="button"
                className="tier-icon-btn"
                onClick={() => setProfileOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={profileOpen}
                aria-label="Profile"
              >
                <span className="tier-avatar tier-avatar--sm">{avatarLabel || 'U'}</span>
              </button>
              {profileOpen && (
                <div className="tier-menu" role="menu">
                  <p className="tier-menu-greeting">Hi! {user?.username}</p>
                </div>
              )}
            </div>

            <button type="button" className="tier-icon-btn" onClick={handleLogout} aria-label="Logout">
              <MdLogout size={20} />
            </button>
          </div>
        </header>

        <main className="dash-main-full">
          <section className="dash-carousel-grid">
            <div className="dash-slide-box">
      <h3 className="dash-section-title">Your rankings</h3>
      <Carousel
        className="carousel--single-item"
        items={ratedItems}
        renderItem={(a) => (
          <div className="dash-highlight-card" style={{ backgroundImage: `url(${a.imageUrl})` }}>
            <span className={`dash-slide-tier dash-slide-tier--${a.tier}`}>{a.tier}</span>
            <div className="dash-highlight-overlay">
              
              <p className="dash-highlight-title">{a.title}</p>
              {a.score != null && <span className="tier-muted">★ {a.score.toFixed(1)}</span>}
            </div>
          </div>
        )}
      />
    </div>

            <div className="dash-slide-box">
      <h3 className="dash-section-title">Trending now</h3>
      <Carousel
        className="carousel--single-item"
        items={trendingItems}
        renderItem={(a) => (
          <div className="dash-highlight-card" style={{ backgroundImage: `url(${a.imageUrl})` }}>
            <div className="dash-highlight-overlay">
              <p className="dash-highlight-title">{a.title}</p>
              {a.score != null && <span className="tier-muted">★ {a.score.toFixed(1)}</span>}
            </div>
          </div>
        )}
      />
    </div>

    {/* Carousel 3: Highlights */}
    <div className="dash-slide-box">
      <h3 className="dash-section-title">Highlights</h3>
      <Carousel
        className="carousel--highlight"
        items={highlightItems}
        renderItem={(a) => (
          <div className="dash-highlight-card" style={{ backgroundImage: `url(${a.imageUrl})` }}>
            <div className="dash-highlight-overlay">
              <p className="dash-highlight-title">{a.title}</p>
              {a.score != null && <span className="tier-muted">★ {a.score.toFixed(1)}</span>}
            </div>
          </div>
        )}
      />
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
      </div>

      <div className={`chat-slide-panel ${chatOpen ? 'chat-slide-panel--open' : ''}`}>
        <div className="chat-slide-panel-topbar">
          <button type="button" className="tier-icon-btn" onClick={() => setChatOpen(false)} aria-label="Close">
            <MdClose size={20} />
          </button>
        </div>
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
