import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { DndContext, useDraggable, useDroppable, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { useNavigate } from 'react-router-dom';
import { MdSpaceDashboard } from 'react-icons/md';
import { MdChatBubbleOutline, MdNotificationsNone, MdLogout, MdClose, MdChevronLeft, MdChevronRight } from 'react-icons/md';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import { groupByFranchise } from '../utils/franchise';
import FriendsPanel from '../components/FriendsPanel';
import FriendsSidebar from '../components/FriendsSidebar';
import CardActionOverlay from '../components/CardActionOverlay';
import '../styles/tierboard.css';

const TIERS = ['S', 'A', 'B', 'C'];
const TIER_STYLES = {
  S: 'tier-row--s',
  A: 'tier-row--a',
  B: 'tier-row--b',
  C: 'tier-row--c',
};

// Up to this many cards fit at normal size in a tier row before shrinking
// kicks in. Beyond that, cards shrink proportionally instead of wrapping
// to a second line -- wrapping is what was growing the row's height and
// pushing every tier below it further down the page. Floored at 45% so
// cards never shrink into illegibility even with a very large tier.
const COMFORTABLE_TIER_COUNT = 10;
const MIN_CARD_SCALE = 0.45;
const cardScale = (count) => {
  if (count <= COMFORTABLE_TIER_COUNT) return 1;
  return Math.max(MIN_CARD_SCALE, COMFORTABLE_TIER_COUNT / count);
};

// Kept in sync with GENRE_MAP in server/src/controllers/anime.controller.js --
// hardcoded here rather than fetched from /api/anime/genres so the picker
// doesn't depend on guessing that endpoint's exact response shape.
const GENRES = [
  { key: 'action', label: 'Action' },
  { key: 'adventure', label: 'Adventure' },
  { key: 'comedy', label: 'Comedy' },
  { key: 'drama', label: 'Drama' },
  { key: 'fantasy', label: 'Fantasy' },
  { key: 'horror', label: 'Horror' },
  { key: 'mystery', label: 'Mystery' },
  { key: 'romance', label: 'Romance' },
  { key: 'sci-fi', label: 'Sci-Fi' },
  { key: 'slice of life', label: 'Slice of Life' },
  { key: 'sports', label: 'Sports' },
  { key: 'supernatural', label: 'Supernatural' },
];

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
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className="tier-card">
      <img src={anime.imageUrl} alt={anime.title} className="w-full h-24 object-cover" />
      <p>{anime.title}</p>
    </div>
  );
};

const StackedCard = ({ group, expanded, onToggle }) => (
  <div className="tier-stack">
    <div className="tier-stack-primary">
      <CardActionOverlay anime={group.primary}>
        <Card anime={group.primary} containerId="pool" />
      </CardActionOverlay>
      {group.related.length > 0 && (
        <button type="button" className="tier-stack-badge" onClick={onToggle}>
          +{group.related.length}
        </button>
      )}
    </div>
    {expanded && group.related.length > 0 && (
      <div className="tier-stack-overlay">
        <button type="button" className="tier-stack-close" onClick={onToggle} aria-label="Close">
          ×
        </button>
        {[group.primary, ...group.related].map((anime) => (
          <CardActionOverlay key={anime.id} anime={anime}>
            <Card anime={anime} containerId="pool" />
          </CardActionOverlay>
        ))}
      </div>
    )}
  </div>
);

const DropZone = ({ id, className, style, children }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} style={style} className={`${className} ${isOver ? 'ring-2 ring-amber-300/50' : ''}`}>
      {children}
    </div>
  );
};

const TierBoardPage = () => {
  const [mode, setMode] = useState('top'); // 'top' | 'genre' | 'watched' | 'recommend' | 'search'
  const [limit, setLimit] = useState(20);
  const [query, setQuery] = useState('');
  const [tiers, setTiers] = useState({ S: [], A: [], B: [], C: [] });
  const [expandedGroupKey, setExpandedGroupKey] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [recommendLoading, setRecommendLoading] = useState(false);
  const [basedOnGenres, setBasedOnGenres] = useState([]);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'saving'
  const [poolError, setPoolError] = useState('');
  const saveTimeout = useRef(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // Every anime.id currently sitting in a tier -- used to hide already-placed
  // cards from the browse/search pool so they don't show up twice.
  const placedIds = useMemo(() => {
    const ids = new Set();
    TIERS.forEach((t) => tiers[t].forEach((a) => ids.add(a.animeId)));
    return ids;
  }, [tiers]);

  // Reset the expanded stack whenever you switch modes -- avoids a stale
  // expanded group lingering visually across an unrelated mode switch.
  useEffect(() => {
    setExpandedGroupKey(null);
  }, [mode]);

  // --- Top ---------------------------------------------------------
  const [topPages, setTopPages] = useState([]);
  const [topPageCursor, setTopPageCursor] = useState(1);
  const [topHasNextPage, setTopHasNextPage] = useState(true);
  const [topLoading, setTopLoading] = useState(false);
  const topLoadingRef = useRef(false);

  const visibleTopGroups = useMemo(() => {
    const unplaced = topPages.filter((a) => !placedIds.has(a.id));
    return groupByFranchise(unplaced).slice(0, limit);
  }, [topPages, placedIds, limit]);

  useEffect(() => {
    if (mode !== 'top') return;
    if (visibleTopGroups.length >= limit) return;
    if (!topHasNextPage || topLoadingRef.current) return;
    if (topPageCursor > 8) return;
    topLoadingRef.current = true;
    setTopLoading(true);

    axiosClient
      .get(`/api/anime/top?page=${topPageCursor}`)
      .then((res) => {
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
        setPoolError(err.response?.data?.message || 'Could not load anime right now.');
        setTopHasNextPage(false);
      })
      .finally(() => {
        topLoadingRef.current = false;
        setTopLoading(false);
      });
  }, [mode, visibleTopGroups.length, limit, topHasNextPage, topPageCursor]);

  // --- Genre ---------------------------------------------------------
  const [selectedGenre, setSelectedGenre] = useState(GENRES[0].key);
  const [genrePages, setGenrePages] = useState([]);
  const [genrePageCursor, setGenrePageCursor] = useState(1);
  const [genreHasNextPage, setGenreHasNextPage] = useState(true);
  const [genreLoading, setGenreLoading] = useState(false);
  const genreLoadingRef = useRef(false);
  const GENRE_LIMIT = 20;

  // Switching genres restarts pagination from page 1 for the new genre --
  // same idea as Top's pagination, just reset on every genre change.
  useEffect(() => {
    setGenrePages([]);
    setGenrePageCursor(1);
    setGenreHasNextPage(true);
  }, [selectedGenre]);

  const visibleGenreGroups = useMemo(() => {
    const unplaced = genrePages.filter((a) => !placedIds.has(a.id));
    return groupByFranchise(unplaced).slice(0, GENRE_LIMIT);
  }, [genrePages, placedIds]);

  useEffect(() => {
    if (mode !== 'genre' || !selectedGenre) return;
    if (visibleGenreGroups.length >= GENRE_LIMIT) return;
    if (!genreHasNextPage || genreLoadingRef.current) return;
    if (genrePageCursor > 8) return;
    genreLoadingRef.current = true;
    setGenreLoading(true);

    axiosClient
      .get(`/api/anime/genre?genre=${encodeURIComponent(selectedGenre)}&page=${genrePageCursor}`)
      .then((res) => {
        setPoolError('');
        setGenrePages((prev) => {
          const seen = new Set(prev.map((a) => a.id));
          const merged = [...prev];
          res.data.results.forEach((a) => {
            if (!seen.has(a.id)) merged.push(a);
          });
          return merged;
        });
        setGenreHasNextPage(res.data.hasNextPage);
        setGenrePageCursor((p) => p + 1);
      })
      .catch((err) => {
        setPoolError(err.response?.data?.message || 'Could not load this genre right now.');
        setGenreHasNextPage(false);
      })
      .finally(() => {
        genreLoadingRef.current = false;
        setGenreLoading(false);
      });
  }, [mode, selectedGenre, visibleGenreGroups.length, genreHasNextPage, genrePageCursor]);

  // --- Watched ---------------------------------------------------------
  const [watchedItems, setWatchedItems] = useState([]);

  useEffect(() => {
    if (mode !== 'watched') return;
    setPoolError('');
    axiosClient
      .get('/api/watched')
      .then((res) => {
        // reshape animeId -> id so it matches the Card/pool shape used everywhere else
        setWatchedItems(res.data.items.map((i) => ({ id: i.animeId, title: i.title, imageUrl: i.imageUrl })));
      })
      .catch((err) => setPoolError(err.response?.data?.message || 'Could not load your watched list.'));
  }, [mode]);

  const visibleWatched = useMemo(
    () => watchedItems.filter((a) => !placedIds.has(a.id)),
    [watchedItems, placedIds]
  );

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

  // --- Recommended ---------------------------------------------------------
  useEffect(() => {
    if (mode !== 'recommend') return;
    setRecommendLoading(true);
    setPoolError('');
    axiosClient
      .get('/api/tierlist/recommendations?category=anime')
      .then((res) => {
        setRecommendations(res.data.recommendations);
        setBasedOnGenres(res.data.basedOnGenres);
      })
      .catch((err) => {
        setPoolError(err.response?.data?.message || 'Could not get recommendations right now.');
        setRecommendations([]);
      })
      .finally(() => setRecommendLoading(false));
  }, [mode]);

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
      const cleaned = Object.fromEntries(
        TIERS.map((t) => [t, prev[t].filter((a) => a.animeId !== anime.id)])
      );

      if (destination === 'pool') {
        scheduleSave(cleaned);
        return cleaned;
      }

      if (!destination.startsWith('tier-')) return prev;

      const tierKey = destination.replace('tier-', '');
      const next = {
        ...cleaned,
        [tierKey]: [
          ...cleaned[tierKey],
          { animeId: anime.id, title: anime.title, imageUrl: anime.imageUrl, genres: anime.genres || [], score: anime.score ?? null },
        ],
      };
      scheduleSave(next);
      return next;
    });
  };

  // --- Email export ---------------------------------------------------
  const [recipientsInput, setRecipientsInput] = useState('');
  const [emailStatus, setEmailStatus] = useState('idle');

  const handleEmail = async () => {
    setEmailStatus('sending');
    try {
      const recipients = recipientsInput.trim()
        ? recipientsInput.split(',').map((e) => e.trim()).filter(Boolean)
        : undefined;
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

  // Without an activation distance, dnd-kit's PointerSensor starts tracking
  // a potential drag on the very first pixel of movement -- and suppresses
  // the browser's normal click event even for a tap with zero movement.
  // Requiring 8px of movement before dnd-kit engages means a genuine tap
  // passes through untouched (so CardActionOverlay's onClick actually
  // fires), while real dragging is unaffected since it naturally involves
  // far more than 8px of movement.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const pool =
    mode === 'search' ? visibleSearch : mode === 'watched' ? visibleWatched : recommendations.filter((a) => !placedIds.has(a.id));

  const displayName = user?.username || user?.email?.split('@')[0] || 'Profile';
  const avatarLabel = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="tier-page">
        <header className="tier-topbar">
          <div className="tier-brand">
            <div className="tier-brand-mark">◎</div>
            <div className="tier-brand-copy">
              <h1 className="tier-brand-title">Tier List Hub</h1>
              <p className="tier-brand-subtitle">Your rankings, your rules.</p>
            </div>
          </div>

          <div className="tier-topbar-actions">
            <button type="button" className="tier-icon-btn" onClick={() => navigate('/dashboard')} aria-label="Dashboard">
              <MdSpaceDashboard size={20} />
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

        <div className="tier-shell">
          <main className="tier-dashboard">
            <section className="tier-panel tier-panel--left">
              <div className="tier-controls">
                <button type="button" onClick={() => setMode('top')} className={`tier-control ${mode === 'top' ? 'is-active' : ''}`}>
                  Top
                </button>
                <button type="button" onClick={() => setMode('genre')} className={`tier-control ${mode === 'genre' ? 'is-active' : ''}`}>
                  Genre
                </button>
                <button type="button" onClick={() => setMode('watched')} className={`tier-control ${mode === 'watched' ? 'is-active' : ''}`}>
                  Watched
                </button>
                <button type="button" onClick={() => setMode('recommend')} className={`tier-control ${mode === 'recommend' ? 'is-active' : ''}`}>
                  Recommended
                </button>
                <button type="button" onClick={() => setMode('search')} className={`tier-control ${mode === 'search' ? 'is-active' : ''}`}>
                  Search
                </button>
              </div>

              {mode === 'top' && (
                <div className="tier-controls tier-controls--sub">
                  {[20, 30, 50].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setLimit(n)}
                      className={`tier-control tier-control--sub ${limit === n ? 'is-active' : ''}`}
                    >
                      Top {n}
                    </button>
                  ))}
                </div>
              )}

              {mode === 'genre' && (
                <div className="tier-controls tier-controls--sub">
                  {GENRES.map((g) => (
                    <button
                      key={g.key}
                      type="button"
                      onClick={() => setSelectedGenre(g.key)}
                      className={`tier-control tier-control--sub ${selectedGenre === g.key ? 'is-active' : ''}`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              )}

              {mode === 'search' && (
                <input
                  className="tier-search"
                  placeholder="Search anime by name..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              )}
              {mode === 'recommend' && basedOnGenres.length > 0 && (
                <p className="tier-muted">Based on your S/A picks: {basedOnGenres.join(', ')}</p>
              )}

              {poolError && <p className="tier-error">{poolError}</p>}

              <DropZone id="pool" className="tier-pool">
                {mode === 'top' &&
                  visibleTopGroups.map((group) => (
                    <StackedCard
                      key={group.key}
                      group={group}
                      expanded={expandedGroupKey === group.key}
                      onToggle={() => setExpandedGroupKey((k) => (k === group.key ? null : group.key))}
                    />
                  ))}
                {mode === 'genre' &&
                  visibleGenreGroups.map((group) => (
                    <StackedCard
                      key={group.key}
                      group={group}
                      expanded={expandedGroupKey === group.key}
                      onToggle={() => setExpandedGroupKey((k) => (k === group.key ? null : group.key))}
                    />
                  ))}
                {(mode === 'search' || mode === 'watched' || mode === 'recommend') &&
                  pool.map((anime) => (
                    <CardActionOverlay key={anime.id} anime={anime}>
                      <Card anime={anime} containerId="pool" />
                    </CardActionOverlay>
                  ))}
                {mode === 'top' && topLoading && <p className="tier-loading">Loading more…</p>}
                {mode === 'genre' && genreLoading && <p className="tier-loading">Loading more…</p>}
              </DropZone>
            </section>

            <section className="tier-ranking-panel">
              <div className="tier-ranking-head">
                <div className="tier-ranking-copy">
                  <p className="tier-ranking-kicker">Tier ranking</p>
                  <h2 className="tier-ranking-title">Arrange the lineup</h2>
                  <span className="tier-muted tier-ranking-subtitle">
                    {mode === 'top' && 'Browse the top ranked series'}
                    {mode === 'genre' && `Browsing ${GENRES.find((g) => g.key === selectedGenre)?.label || 'a genre'}`}
                    {mode === 'watched' && "Anime you've already watched"}
                    {mode === 'recommend' && 'Picked based on your S/A tier'}
                    {mode === 'search' && 'Search for any anime title'}
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
                    <button type="button" onClick={handleEmail} disabled={emailStatus === 'sending'} className="tier-email-button">
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
                      <DropZone
                        id={`tier-${t}`}
                        className="tier-row-drop"
                        style={{ '--card-scale': cardScale(tiers[t].length) }}
                      >
                        {tiers[t].map((anime) => (
                          <CardActionOverlay
                            key={anime.animeId}
                            anime={{ id: anime.animeId, title: anime.title, imageUrl: anime.imageUrl }}
                          >
                            <Card
                              anime={{ id: anime.animeId, title: anime.title, imageUrl: anime.imageUrl }}
                              containerId={`tier-${t}`}
                            />
                          </CardActionOverlay>
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
