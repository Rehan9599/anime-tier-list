import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MdClose } from 'react-icons/md';
import axiosClient from '../api/axiosClient';
import { useWatchStatus } from '../context/WatchStatusContext';

const POPUP_WIDTH = 180;
const SCREEN_MARGIN = 8;
const CLOSE_GRACE_MS = 150; // lets the mouse travel from the card up into the (portal-detached) popup without it closing prematurely

// Devices with a real mouse get hover-to-preview; touch devices (no
// meaningful hover) get tap-to-toggle instead -- mixing both on the same
// element causes a click right after a hover-open to immediately close it.
const supportsHover =
  typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(hover: hover)').matches;

const CardActionOverlay = ({ anime, children }) => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [position, setPosition] = useState(null);
  const wrapRef = useRef(null);
  const popupRef = useRef(null);
  const closeTimeoutRef = useRef(null);

  const { watchedIds, watchlistIds, refresh } = useWatchStatus();
  const isWatched = watchedIds.has(anime.id);
  const isWatchlisted = watchlistIds.has(anime.id);

  const cancelClose = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  const closeNow = () => {
    setOpen(false);
    setMessage('');
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimeoutRef.current = setTimeout(closeNow, CLOSE_GRACE_MS);
  };

  const openPopup = () => {
    cancelClose();
    if (wrapRef.current) {
      const rect = wrapRef.current.getBoundingClientRect();
      const idealLeft = rect.left + rect.width / 2;
      const clampedLeft = Math.min(
        Math.max(idealLeft, POPUP_WIDTH / 2 + SCREEN_MARGIN),
        window.innerWidth - POPUP_WIDTH / 2 - SCREEN_MARGIN
      );
      setPosition({ left: clampedLeft, top: rect.top });
    }
    setOpen(true);
  };

  // Touch devices: tap outside (anywhere not the card or the popup) closes it.
  useEffect(() => {
    if (!open || supportsHover) return;
    const handleOutside = (e) => {
      const clickedWrap = wrapRef.current && wrapRef.current.contains(e.target);
      const clickedPopup = popupRef.current && popupRef.current.contains(e.target);
      if (!clickedWrap && !clickedPopup) closeNow();
    };
    document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, [open]);

  useEffect(() => () => cancelClose(), []);

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
      refresh();
    } catch {
      setMessage('Could not save.');
    }
    setTimeout(closeNow, 700);
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
      refresh();
    } catch {
      setMessage('Could not save.');
    }
    setTimeout(closeNow, 700);
  };

  const wrapHandlers = supportsHover
    ? { onMouseEnter: openPopup, onMouseLeave: scheduleClose }
    : { onClick: () => (open ? closeNow() : openPopup()) };

  const popupHandlers = supportsHover ? { onMouseEnter: cancelClose, onMouseLeave: scheduleClose } : {};

  let content;
  if (message) {
    content = <p className="card-action-message">{message}</p>;
  } else if (isWatched) {
    content = <p className="card-action-status">✓ Already watched</p>;
  } else if (isWatchlisted) {
    content = <p className="card-action-status">On your watchlist</p>;
  } else {
    content = (
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
    );
  }

  return (
    <div className="card-action-wrap" ref={wrapRef} {...wrapHandlers}>
      {children}

      {open &&
        position &&
        createPortal(
          <div
            ref={popupRef}
            className="card-action-popup"
            style={{ left: position.left, top: position.top }}
            onClick={stop}
            {...popupHandlers}
          >
            <button type="button" className="card-action-close" onClick={closeNow} aria-label="Close">
              <MdClose size={16} />
            </button>

            <div className="card-action-image" style={{ backgroundImage: `url(${anime.imageUrl})` }} />

            <div className="card-action-content">{content}</div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default CardActionOverlay;
