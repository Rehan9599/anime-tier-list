import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { DndContext, useDraggable, useDroppable } from '@dnd-kit/core';
import { useNavigate, Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';

const TIERS = ['S', 'A', 'B', 'C'];
const TIER_STYLES = {
  S: 'bg-red-50 border-red-200',
  A: 'bg-orange-50 border-orange-200',
  B: 'bg-yellow-50 border-yellow-200',
  C: 'bg-green-50 border-green-200',
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
      className="w-20 shrink-0 cursor-grab active:cursor-grabbing rounded-lg overflow-hidden bg-white border border-gray-200 shadow-sm"
    >
      <img src={anime.imageUrl} alt={anime.title} className="w-full h-24 object-cover" />
      <p className="text-[10px] p-1 truncate">{anime.title}</p>
    </div>
  );
};

const DropZone = ({ id, className, children }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`${className} ${isOver ? 'ring-2 ring-black/20' : ''}`}>
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
  const saveTimeout = useRef(null);
  const navigate = useNavigate();

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
    navigate('/login');
  };
  const pool = mode === 'top' ? visibleTop : visibleSearch;

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="max-w-5xl mx-auto mt-8 p-6">
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <h1 className="text-xl font-medium mr-auto">My anime tier list</h1>
          <span className="text-xs text-gray-400">
            {saveStatus === 'saving' ? 'Saving…' : 'Saved ✓'}
          </span>
          <input
            type="text"
            placeholder="Friend's email (optional)"
            value={recipientsInput}
            onChange={(e) => setRecipientsInput(e.target.value)}
            className="border rounded-lg px-2 py-1.5 text-sm w-48"
          />
          <button
            onClick={handleEmail}
            disabled={emailStatus === 'sending'}
            className="px-3 py-1.5 rounded-lg bg-black text-white text-sm disabled:opacity-50"
          >
            {emailStatus === 'sending' ? 'Sending…' : 'Email list'}
          </button>
          <button onClick={handleLogout} className="px-3 py-1.5 rounded-lg bg-black text-white text-sm">
            logout
          </button>
        </div>

        {TIERS.map((t) => (
          <div key={t} className={`flex border-2 rounded-lg mb-3 ${TIER_STYLES[t]}`}>
            <div className="w-12 flex items-center justify-center font-bold">{t}</div>
            <DropZone id={`tier-${t}`} className="flex-1 flex flex-wrap gap-2 p-2 min-h-[110px]">
              {tiers[t].map((anime) => (
                <Card
                  key={anime.animeId}
                  anime={{ id: anime.animeId, title: anime.title, imageUrl: anime.imageUrl }}
                  containerId={`tier-${t}`}
                />
              ))}
            </DropZone>
          </div>
        ))}

        <div className="mt-6 border-t pt-4">
          <div className="flex gap-2 mb-3 flex-wrap">
            <button
              onClick={() => setMode('top')}
              className={`px-3 py-1.5 rounded-lg text-sm ${mode === 'top' ? 'bg-black text-white' : 'bg-gray-100'}`}
            >
              Top rated
            </button>
            <button
              onClick={() => setMode('search')}
              className={`px-3 py-1.5 rounded-lg text-sm ${mode === 'search' ? 'bg-black text-white' : 'bg-gray-100'}`}
            >
              Search
            </button>
            {mode === 'top' &&
              [20, 30, 50].map((n) => (
                <button
                  key={n}
                  onClick={() => setLimit(n)}
                  className={`px-3 py-1 rounded-lg text-xs ${limit === n ? 'bg-black text-white' : 'bg-gray-100'}`}
                >
                  Top {n}
                </button>
              ))}
          </div>

          {mode === 'search' && (
            <input
              className="w-full border rounded-lg px-3 py-2 mb-3"
              placeholder="Search anime by name..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          )}

          {poolError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
              {poolError}
            </p>
          )}

          <DropZone
            id="pool"
            className="flex flex-wrap gap-2 p-2 min-h-[110px] border-2 border-dashed border-gray-200 rounded-lg"
          >
            {pool.map((anime) => (
              <Card key={anime.id} anime={anime} containerId="pool" />
            ))}
            {mode === 'top' && topLoading && (
              <p className="text-xs text-gray-400 self-center px-2">Loading more…</p>
            )}
          </DropZone>
        </div>
      </div>
    </DndContext>
  );
};

export default TierBoardPage;
