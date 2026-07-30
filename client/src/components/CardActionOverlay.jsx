import { useState } from 'react';
import { MdClose } from 'react-icons/md';
import axiosClient from '../api/axiosClient';

// Wraps any existing card markup -- tapping anywhere on it opens a small
// overlay with the two actions, without needing to touch the Card
// component itself. Usage: <CardActionOverlay anime={anime}><Card .../></CardActionOverlay>
//
// This relies on click bubbling from the existing Card up to this
// wrapper's onClick, which is separate from dnd-kit's drag listeners --
// dnd-kit only treats a pointer-down as a drag once it's moved past its
// activation threshold, so a genuine tap (no movement) still fires this
// onClick normally. If tapping ever feels like it's fighting with
// dragging in practice, that's the thing to look at first.
const CardActionOverlay = ({ anime, children }) => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');

  const stop = (e) => e.stopPropagation();

  const markWatched = async (e) => {
    stop(e);
    try {
      await axiosClient.post('/api/watched', {
        animeId: anime.id,
        title: anime.title,
        imageUrl: anime.imageUrl,
        watched: true,
      });
      setMessage('Marked as watched');
    } catch {
      setMessage('Could not save.');
    }
    setTimeout(() => {
      setOpen(false);
      setMessage('');
    }, 700);
  };

  const addToWatchlist = async (e) => {
    stop(e);
    try {
      await axiosClient.post('/api/watchlist', {
        animeId: anime.id,
        title: anime.title,
        imageUrl: anime.imageUrl,
      });
      setMessage('Added to watchlist');
    } catch {
      setMessage('Could not save.');
    }
    setTimeout(() => {
      setOpen(false);
      setMessage('');
    }, 700);
  };

  return (
    <div className="card-action-wrap" onClick={() => setOpen((o) => !o)}>
      {children}
      {open && (
        <div className="card-action-overlay" onClick={stop}>
          <button
            type="button"
            className="card-action-close"
            onClick={(e) => {
              stop(e);
              setOpen(false);
            }}
            aria-label="Close"
          >
            <MdClose size={16} />
          </button>

          {message ? (
            <p className="card-action-message">{message}</p>
          ) : (
            <div className="card-action-buttons">
              <button type="button" className="card-action-btn" onClick={addToWatchlist}>
                Add to watchlist
              </button>
              <button type="button" className="card-action-btn card-action-btn--primary" onClick={markWatched}>
                Already watched
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CardActionOverlay;
