import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { DndContext, useDraggable, useDroppable } from '@dnd-kit/core';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import '../styles/tierboard.css';

const TIERS = ['S', 'A', 'B', 'C'];
const TIER_STYLES = {
  S: 'tier-row--s',
  A: 'tier-row--a',
  B: 'tier-row--b',
  C: 'tier-row--c',
};

// A draggable anime card. `containerId` just keeps dnd-kit ids unique
// between the pool and the tier rows -- it isn't used for logic.
const Card = ({ anime, containerId }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `${containerId}:${anime.id}`,
    data: { anime },
  });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="tier-card"
    >
      <img src={anime.imageUrl} alt={anime.title} className="w-full h-24 object-cover" />
      <p>{anime.title}</p>
    </div>
  );
};

const DropZone = ({ id, className, children }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`${className} ${isOver ? 'ring-2 ring-amber-300/50' : ''}`}>
      {children}
    </div>
  );
};

const TierBoardPage = () => {
  const [mode, setMode] = useState('top'); // 'top' | 'search'
  const [limit, setLimit] = useState(20);
  const [query, setQuery] = useState('');
  const [tiers, setTiers] = useState({ S: [], A: [], B: [], C: [] });
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'saving'
  const [poolError, setPoolError] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const saveTimeout = useRef(null);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // Every anime.id currently sitting in a tier -- used to hide already-placed
  // cards from the browse/search pool so they don't show up twice.
  const placedIds = useMemo(() => {
    const ids = new Set();
    TIERS.forEach((t) => tiers[t].forEach((a) => ids.add(a.animeId)));
    return ids;
  }, [tiers]);

  // --- Top-rated browsing, with pagination-based backfill -----------------
  // Jikan/AniList return a fixed page size, not an arbitrary count, so we
  // accumulate pages here and reveal up to `limit` unplaced items. As items
  // get dragged into tiers they disappear from `visibleTop`, which drops
  // below `limit` and triggers fetching the next page automatically --
  // that's what makes "top 20" always show 20 even as you place anime.
  const [topPages, setTopPages] = useState([]);
  const [topPageCursor, setTopPageCursor] = useState(1);
  const [topHasNextPage, setTopHasNextPage] = useState(true);
  const [topLoading, setTopLoading] = useState(false);

  const visibleTop = useMemo(
    () => topPages.filter((a) => !placedIds.has(a.id)).slice(0, limit),
    [topPages, placedIds, limit]
  );

  useEffect(() => {
    if (mode !== 'top') return;
    if (visibleTop.length >= limit) return;
    if (!topHasNextPage || topLoading) return;

    let cancelled = false;
    setTopLoading(true);

    axiosClient
      .get(`/api/anime/top?page=${topPageCursor}`)
      .then((res) => {
        if (cancelled) return;
        setPoolError('');
        setTopPages((prev) => {
          const seen = new Set(prev.map((a) => a.id));
          const merged = [...prev];
          res.data.results.forEach((a) => {
            if (!seen.has(a.id)) merged.push(a);
          });
          return merged;
        });
        setTopHasNextPage(res.data.hasNextPage);
        setTopPageCursor((p) => p + 1);
      })
      .catch((err) => {
        if (cancelled) return;
        setPoolError(err.response?.data?.message || 'Could not load anime right now.');
        setTopHasNextPage(false); // stop retrying automatically on a persistent failure
      })
      .finally(() => {
        if (!cancelled) setTopLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mode, visibleTop.length, limit, topHasNextPage, topLoading, topPageCursor]);

  // --- Search ---------------------------------------------------------
  const [searchResults, setSearchResults] = useState([]);
  const visibleSearch = useMemo(
    () => searchResults.filter((a) => !placedIds.has(a.id)),
    [searchResults, placedIds]
  );

  useEffect(() => {
    if (mode !== 'search' || query.trim().length < 2) return;
    const t = setTimeout(() => {
      setPoolError('');
      axiosClient
        .get(`/api/anime/search?q=${encodeURIComponent(query)}`)
        .then((res) => setSearchResults(res.data.results))
        .catch((err) => setPoolError(err.response?.data?.message || 'Search failed. Try again.'));
    }, 300);
    return () => clearTimeout(t);
  }, [mode, query]);

  // --- Tier list load / autosave ---------------------------------------
  useEffect(() => {
    axiosClient.get('/api/tierlist?category=anime').then((res) => {
      setTiers(res.data.tierList.tiers);
    });
  }, []);

  const scheduleSave = useCallback((nextTiers) => {
    setSaveStatus('saving');
    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      await axiosClient.put('/api/tierlist', { category: 'anime', tiers: nextTiers });
      setSaveStatus('saved');
    }, 800);
  }, []);

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over) return;

    const anime = active.data.current.anime;
    const destination = over.id; // 'tier-S' | 'tier-A' | 'tier-B' | 'tier-C' | 'pool'

    setTiers((prev) => {
      // Remove this anime from every tier first (covers re-dragging an
      // already-placed card into a different tier, or back out entirely).
      const cleaned = Object.fromEntries(
        TIERS.map((t) => [t, prev[t].filter((a) => a.animeId !== anime.id)])
      );

      if (destination === 'pool') {
        // Dropped back onto the browse pool -- un-place it.
        scheduleSave(cleaned);
        return cleaned;
      }

      if (!destination.startsWith('tier-')) return prev; // dropped somewhere invalid

      const tierKey = destination.replace('tier-', '');
      const next = {
        ...cleaned,
        [tierKey]: [
          ...cleaned[tierKey],
          { animeId: anime.id, title: anime.title, imageUrl: anime.imageUrl },
        ],
      };
      scheduleSave(next);
      return next;
    });
  };

  // --- Email export, including optional custom recipients -----------------
  const [recipientsInput, setRecipientsInput] = useState('');
  const [emailStatus, setEmailStatus] = useState('idle'); // 'idle' | 'sending'

  const handleEmail = async () => {
    setEmailStatus('sending');
    try {
      const recipients = recipientsInput.trim()
        ? recipientsInput.split(',').map((e) => e.trim()).filter(Boolean)
        : undefined; // omitted -> server defaults to your own account email
      const res = await axiosClient.post('/api/tierlist/email', { category: 'anime', recipients });
      alert(res.data.message);
    } catch (err) {
      alert(err.response?.data?.message || 'Could not send email.');
    } finally {
      setEmailStatus('idle');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };
  const pool = mode === 'top' ? visibleTop : visibleSearch;
  const displayName = user?.username || user?.email?.split('@')[0] || 'Profile';
  const avatarLabel = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="tier-page">
        <header className="tier-topbar">
          <div className="tier-brand">
            <div className="tier-brand-mark">◎</div>
            <div className="tier-brand-copy">
              <h1 className="tier-brand-title">My anime tier list</h1>
              <p className="tier-brand-subtitle">Build, save, and share rankings with an anime-themed workspace.</p>
            </div>
          </div>

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
                <button
                  type="button"
                  className="tier-menu-item"
                  onClick={() => {
                    setProfileOpen(false);
                    navigate('/dashboard');
                  }}
                >
                  Dashboard
                </button>
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
        </header>

        <div className="tier-shell">
          <main className="tier-dashboard">
            <section className="tier-panel tier-panel--left">
              <div className="tier-controls">
                {mode === 'top' &&
                  [20, 30].map((n) => (
                    <button
                      key={n}
                      onClick={() => setLimit(n)}
                      className={`tier-control ${limit === n ? 'is-active' : ''}`}
                    >
                      Top {n}
                    </button>
                  ))}
                <button
                  type="button"
                  onClick={() => setMode('search')}
                  className={`tier-control ${mode === 'search' ? 'is-active' : ''}`}
                >
                  Search
                </button>
              </div>

              {mode === 'search' && (
                <input
                  className="tier-search"
                  placeholder="Search anime by name..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              )}

              {poolError && <p className="tier-error">{poolError}</p>}

              <DropZone id="pool" className="tier-pool">
                {pool.map((anime) => (
                  <Card key={anime.id} anime={anime} containerId="pool" />
                ))}
                {mode === 'top' && topLoading && <p className="tier-loading">Loading more…</p>}
              </DropZone>
            </section>

            <section className="tier-ranking-panel">
              <div className="tier-ranking-head">
                <div className="tier-ranking-copy">
                  <p className="tier-ranking-kicker">Tier ranking</p>
                  <h2 className="tier-ranking-title">Arrange the lineup</h2>
                  <span className="tier-muted tier-ranking-subtitle">
                    {mode === 'top' ? 'Browse the top ranked series' : 'Search for any anime title'}
                  </span>
                </div>

                <div className="tier-ranking-actions">
                  <div className="tier-email-actions">
                    <input
                      type="text"
                      placeholder="Friend's email (optional)"
                      value={recipientsInput}
                      onChange={(e) => setRecipientsInput(e.target.value)}
                      className="tier-email-input"
                    />
                    <button
                      type="button"
                      onClick={handleEmail}
                      disabled={emailStatus === 'sending'}
                      className="tier-email-button"
                    >
                      {emailStatus === 'sending' ? 'Sending…' : 'Email list'}
                    </button>
                  </div>
                </div>
              </div>
              <div className="tier-ranking-stack">
                {TIERS.map((t) => (
                  <section key={t} className={`tier-section ${TIER_STYLES[t]}`}>
                    <div className="tier-row">
                      <div className="tier-row-label">{t}</div>
                      <DropZone id={`tier-${t}`} className="tier-row-drop">
                        {tiers[t].map((anime) => (
                          <Card
                            key={anime.animeId}
                            anime={{ id: anime.animeId, title: anime.title, imageUrl: anime.imageUrl }}
                            containerId={`tier-${t}`}
                          />
                        ))}
                      </DropZone>
                    </div>
                  </section>
                ))}
              </div>
            </section>
          </main>
        </div>
      </div>
    </DndContext>
  );
};

export default TierBoardPage;
