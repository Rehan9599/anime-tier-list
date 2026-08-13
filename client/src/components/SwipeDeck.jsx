import { useState, useEffect } from 'react';
import { MdClose, MdCheck } from 'react-icons/md';
import axiosClient from '../api/axiosClient';

const SwipeDeck = ({ items, onClose }) => {
  const [index, setIndex] = useState(0);
  const [exiting, setExiting] = useState(null); // { direction: 'right' | 'left' } | null

  // Once every item's been answered, close automatically rather than
  // leaving an empty modal on screen.
  useEffect(() => {
    if (index >= items.length) onClose();
  }, [index, items.length, onClose]);

  const answer = (watched) => {
    const current = items[index];
    if (!current || exiting) return;

    setExiting({ direction: watched ? 'right' : 'left' });

    // Fire-and-forget save -- the swipe animation isn't held up by the
    // network round trip, and losing one save to a flaky connection just
    // means that title gets asked again next time, not a broken UI.
    axiosClient
      .post('/api/watched', {
        animeId: current.id,
        title: current.title,
        imageUrl: current.imageUrl,
        watched,
        genres: current.genres || [],
      })
      .catch(() => {});

    setTimeout(() => {
      setExiting(null);
      setIndex((i) => i + 1);
    }, 320);
  };

  if (index >= items.length) return null;

  return (
    <div className="swipe-overlay">
      <div className="swipe-modal">
        <button type="button" className="swipe-close" onClick={onClose} aria-label="Close">
          <MdClose size={22} />
        </button>

        <p className="swipe-caption">Have you watched this?</p>

        <div className="swipe-stack">
          {items.slice(index, index + 3).map((item, i) => {
            const isTop = i === 0;
            const exitClass = isTop && exiting ? `swipe-card--exit-${exiting.direction}` : '';
            return (
              <div key={item.id} className={`swipe-card swipe-card--pos-${i} ${exitClass}`}>
                <img src={item.imageUrl} alt={item.title} />
                <div className="swipe-card-overlay">
                  <p className="swipe-card-title">{item.title}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="swipe-actions">
          <button type="button" className="swipe-btn swipe-btn--no" onClick={() => answer(false)} aria-label="Haven't watched">
            <MdClose size={26} />
          </button>
          <button type="button" className="swipe-btn swipe-btn--yes" onClick={() => answer(true)} aria-label="Watched">
            <MdCheck size={26} />
          </button>
        </div>

        <p className="swipe-progress">
          {index + 1} / {items.length}
        </p>
      </div>
    </div>
  );
};

export default SwipeDeck;
