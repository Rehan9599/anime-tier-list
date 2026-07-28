import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdArrowBack } from 'react-icons/md';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';

const ProfilePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [watched, setWatched] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axiosClient.get('/api/watched').then((res) => {
      setWatched(res.data.items);
      setLoading(false);
    });
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
            <p className="tier-brand-subtitle">{watched.length} anime watched</p>
          </div>
        </div>
      </header>

      <div className="profile-content">
        <h3 className="dash-section-title">Watched anime</h3>

        {loading && <p className="tier-muted">Loading...</p>}
        {!loading && watched.length === 0 && (
          <p className="tier-muted">
            Nothing marked as watched yet -- answer the quiz next time it pops up after logging in!
          </p>
        )}

        <div className="profile-watched-grid">
          {watched.map((a) => (
            <div key={a.animeId} className="dash-poster-card">
              <img src={a.imageUrl} alt={a.title} />
              <p>{a.title}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
