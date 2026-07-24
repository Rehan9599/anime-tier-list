import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import ChatWidget from '../components/ChatWidget';

const TIERS = ['S', 'A', 'B', 'C'];
const TIER_STYLES = {
  S: 'tier-row--s',
  A: 'tier-row--a',
  B: 'tier-row--b',
  C: 'tier-row--c',
};

const FriendTierListPage = () => {
  const { friendId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [friendUsername, setFriendUsername] = useState('');
  const [tiers, setTiers] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    axiosClient
      .get(`/api/tierlist/friend/${friendId}?category=anime`)
      .then((res) => {
        setFriendUsername(res.data.friendUsername);
        setTiers(res.data.tiers);
      })
      .catch((err) => setError(err.response?.data?.message || 'Could not load this tier list.'));
  }, [friendId]);

  if (error) {
    return (
      <div className="tier-page">
        <p className="tier-error" style={{ margin: '40px auto', maxWidth: 400 }}>
          {error}
        </p>
        <button type="button" className="tier-control" onClick={() => navigate(-1)} style={{ display: 'block', margin: '0 auto' }}>
          Go back
        </button>
      </div>
    );
  }

  if (!tiers) return null;

  return (
    <div className="tier-page">
      <header className="tier-topbar">
        <div className="tier-brand">
          <div className="tier-brand-mark">◎</div>
          <div className="tier-brand-copy">
            <h1 className="tier-brand-title">{friendUsername}'s anime tier list</h1>
            <p className="tier-brand-subtitle">Read-only -- this is their board, not yours.</p>
          </div>
        </div>
        <button type="button" className="tier-control" onClick={() => navigate(-1)}>
          Back
        </button>
      </header>

      <div className="tier-shell">
        <main className="tier-ranking-panel" style={{ width: '100%' }}>
          <div className="tier-ranking-stack">
            {TIERS.map((t) => (
              <section key={t} className={`tier-section ${TIER_STYLES[t]}`}>
                <div className="tier-row">
                  <div className="tier-row-label">{t}</div>
                  <div className="tier-row-drop">
                    {tiers[t].length === 0 && <p className="tier-muted">Nothing here yet.</p>}
                    {tiers[t].map((anime) => (
                      <div key={anime.animeId} className="tier-card">
                        <img src={anime.imageUrl} alt={anime.title} className="w-full h-24 object-cover" />
                        <p>{anime.title}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            ))}
          </div>
        </main>
      </div>

      <div className="chat-corner">
        <ChatWidget friendId={friendId} friendUsername={friendUsername} myUserId={user?.id} />
      </div>
    </div>
  );
};

export default FriendTierListPage;
