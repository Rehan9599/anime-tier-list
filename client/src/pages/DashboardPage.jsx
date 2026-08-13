import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MdChatBubbleOutline, MdNotificationsNone, MdLogout, MdClose } from 'react-icons/md';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import FriendsSidebar from '../components/FriendsSidebar';
import StackedCarousel from '../components/StackedCarousel';
import PosterRow from '../components/PosterRow';
import WatchedPromptGate from '../components/WatchedPromptGate';

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
      ).filter((a) => a.imageUrl && a.title);
      setRatedItems(flattened);
    });

    axiosClient.get('/api/anime/trending').then((res) =>
      setTrendingItems(res.data.results.filter((a) => a.imageUrl && a.title))
    );
    axiosClient.get('/api/anime/top?page=1').then((res) =>
      setHighlightItems(res.data.results.filter((a) => a.imageUrl && a.title).slice(0, 8))
    );

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

  const renderRankedItem = (a) => (
    <div className="dash-highlight-card" style={{ backgroundImage: `url(${a.imageUrl})` }}>
      <span className={`dash-slide-tier dash-slide-tier--${a.tier}`}>{a.tier}</span>
      <div className="dash-highlight-overlay">
        <p className="dash-highlight-title">{a.title}</p>
        {a.score != null && <span className="tier-muted">★ {a.score.toFixed(1)}</span>}
      </div>
    </div>
  );

  const renderStandardItem = (a) => (
    <div className="dash-highlight-card" style={{ backgroundImage: `url(${a.imageUrl})` }}>
      <div className="dash-highlight-overlay">
        <p className="dash-highlight-title">{a.title}</p>
        {a.score != null && <span className="tier-muted">★ {a.score.toFixed(1)}</span>}
      </div>
    </div>
  );

  const displayName = user?.username || user?.email?.split('@')[0] || 'Profile';
  const avatarLabel = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <div className={`tier-page ${chatOpen ? 'app-shell--chat-open' : ''}`}>
      <WatchedPromptGate />
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
              <button type="button" className="tier-icon-btn" onClick={() => navigate('/profile')} aria-label="Profile">
                <span className="tier-avatar tier-avatar--sm">{avatarLabel || 'U'}</span>
              </button>
            </div>

            <button type="button" className="tier-icon-btn" onClick={handleLogout} aria-label="Logout">
              <MdLogout size={20} />
            </button>
          </div>
        </header>

        <main className="dash-main-full">
          <section className="stacked-carousel-section">
            <div className="stacked-carousel-row">
              <StackedCarousel
                title="Your Rankings"
                items={ratedItems}
                renderItem={renderRankedItem}
                autoMs={2000}
              />
              <StackedCarousel
                title="Trending Now"
                items={trendingItems}
                renderItem={renderStandardItem}
                autoMs={2200}
              />
              <StackedCarousel
                title="Highlights"
                items={highlightItems}
                renderItem={renderStandardItem}
                autoMs={2400}
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
    <span className="chat-slide-panel-title">{chatFriend ? '' : 'Social'}</span>
    <button type="button" className="tier-icon-btn chat-slide-panel-close" onClick={() => setChatOpen(false)} aria-label="Close">
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
