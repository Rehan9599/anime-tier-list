import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdArrowBack } from 'react-icons/md';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';

const ProfileList = ({ title, items, emptyMessage }) => (
  <div className="profile-column">
    <h3 className="dash-section-title">{title}</h3>
    {items.length === 0 ? (
      <p className="tier-muted">{emptyMessage}</p>
    ) : (
      <div className="profile-watched-grid">
        {items.map((a) => (
          <div key={a.animeId} className="profile-poster-card">
            <img src={a.imageUrl} alt={a.title} />
            <p>{a.title}</p>
          </div>
        ))}
      </div>
    )}
  </div>
);

const ProfilePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [watched, setWatched] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState('');
  useEffect(() => {
    let mounted = true;

    const loadProfileData = async () => {
      setLoading(true);
      setProfileError('');

      const results = await Promise.allSettled([
        axiosClient.get('/api/watched'),
        axiosClient.get('/api/watchlist'),
      ]);

      if (!mounted) return;

      const [watchedResult, watchlistResult] = results;

      if (watchedResult.status === 'fulfilled') {
        setWatched(watchedResult.value.data.items);
      }

      if (watchlistResult.status === 'fulfilled') {
        setWatchlist(watchlistResult.value.data.items);
      }

      if (results.some((result) => result.status === 'rejected')) {
        setProfileError(
          'Some profile data could not be loaded. Please try again.'
        );
      }

      setLoading(false);
    };

    loadProfileData();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="tier-page">
      <header className="tier-topbar">
        <div className="tier-brand">
          <button
            type="button"
            className="tier-icon-btn"
            onClick={() => navigate('/dashboard')}
            aria-label="Back to dashboard"
          >
            <MdArrowBack size={20} />
          </button>
          <div className="tier-brand-copy">
            <h1 className="tier-brand-title">{user?.username}'s profile</h1>
            <p className="tier-brand-subtitle">
              {watched.length} watched · {watchlist.length} on watchlist
            </p>
          </div>
        </div>
      </header>

      <div className="profile-content">
        {profileError && (
          <p className="tier-error" role="alert">
            {profileError}
          </p>
        )}
        {loading ? (
          <p className="tier-muted">Loading...</p>
        ) : (
          <div className="profile-columns">
            <ProfileList
              title="Watched"
              items={watched}
              emptyMessage="Nothing marked as watched yet -- answer the quiz next time it pops up after logging in, or tap any anime on the tier board!"
            />
            <ProfileList
              title="Watchlist"
              items={watchlist}
              emptyMessage="Nothing on your watchlist yet -- tap any anime on the tier board and choose 'Add to watchlist.'"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
