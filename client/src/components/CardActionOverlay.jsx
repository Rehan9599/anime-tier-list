import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MdClose } from 'react-icons/md';
import axiosClient from '../api/axiosClient';

const POPUP_WIDTH = 180;
const SCREEN_MARGIN = 8;

// Wraps any existing small card. Tapping it opens a genuinely bigger popup
// card that floats ABOVE the tapped card, rendered via a portal into
// document.body -- this is what makes it escape the tier row's horizontal
// scroll container instead of getting clipped or stretched by it.
const CardActionOverlay = ({ anime, children }) => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [position, setPosition] = useState(null);
  const wrapRef = useRef(null);
  const popupRef = useRef(null);

  const openPopup = () => {
    if (wrapRef.current) {
      const rect = wrapRef.current.getBoundingClientRect();
      const idealLeft = rect.left + rect.width / 2;
      // Clamp so the popup can't get clipped off the left/right edge of the screen.
      const clampedLeft = Math.min(
        Math.max(idealLeft, POPUP_WIDTH / 2 + SCREEN_MARGIN),
        window.innerWidth - POPUP_WIDTH / 2 - SCREEN_MARGIN
      );
      setPosition({ left: clampedLeft, top: rect.top });
    }
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e) => {
      const clickedWrap = wrapRef.current && wrapRef.current.contains(e.target);
      const clickedPopup = popupRef.current && popupRef.current.contains(e.target);
      if (!clickedWrap && !clickedPopup) {
        setOpen(false);
        setMessage('');
      }
    };
    document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, [open]);

  const stop = (e) => e.stopPropagation();
  const close = (e) => {
    if (e) stop(e);
    setOpen(false);
    setMessage('');
  };

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
    setTimeout(close, 700);
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
    setTimeout(close, 700);
  };

  return (
    <div className="card-action-wrap" ref={wrapRef} onClick={openPopup}>
      {children}

      {open &&
        position &&
        createPortal(
          <div
            ref={popupRef}
            className="card-action-popup"
            style={{ left: position.left, top: position.top }}
            onClick={stop}
          >
            <button type="button" className="card-action-close" onClick={close} aria-label="Close">
              <MdClose size={16} />
            </button>

            <div className="card-action-image" style={{ backgroundImage: `url(${anime.imageUrl})` }} />

            <div className="card-action-content">
              {message ? (
                <p className="card-action-message">{message}</p>
              ) : (
                <>
                  <p className="card-action-title">{anime.title}</p>
                  <div className="card-action-buttons">
                    <button type="button" className="card-action-btn" onClick={addToWatchlist}>
                      Watchlist
                    </button>
                    <button type="button" className="card-action-btn card-action-btn--primary" onClick={markWatched}>
                      Watched
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default CardActionOverlay;
