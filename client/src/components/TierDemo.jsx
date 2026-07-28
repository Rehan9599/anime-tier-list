import { useState, useEffect } from 'react';

// Only 2 entries have a verified real MAL image URL right now -- see the
// note in the chat this came from. Paste more from any anime's MAL page
// (right-click the cover -> Copy image address) to fill out the rest;
// same shape, `imageUrl` is optional -- items without one just render as
// a text chip instead of a poster thumbnail.
const DEMO_ITEMS = [
  {
    title: "Frieren: Beyond Journey's End",
    tier: 'S',
    imageUrl: 'https://cdn.myanimelist.net/images/anime/1015/138006.jpg',
  },
  {
    title: 'Attack on Titan',
    tier: 'S',
    imageUrl: 'https://cdn.myanimelist.net/images/anime/10/47347.jpg',
  },
  { title: 'Jujutsu Kaisen', tier: 'A' },
  { title: 'Demon Slayer', tier: 'A' },
  { title: 'One Piece', tier: 'B' },
];

const TIERS = ['S', 'A', 'B', 'C'];
const TIER_COLORS = { S: '#f43f5e', A: '#f97316', B: '#eab308', C: '#22c55e' };

const TierDemo = () => {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let count = 0;

    const step = () => {
      if (cancelled) return;
      count = count >= DEMO_ITEMS.length ? 0 : count + 1;
      setVisibleCount(count);
      const delay = count === 0 ? 1400 : count === DEMO_ITEMS.length ? 2200 : 1100;
      timeoutId = setTimeout(step, delay);
    };

    let timeoutId = setTimeout(step, 1100);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, []);

  return (
    <div className="tier-demo">
      <p className="tier-demo-caption">Rank anything. Instantly.</p>
      <div className="tier-demo-rows">
        {TIERS.map((tier) => (
          <div key={tier} className="tier-demo-row">
            <span className="tier-demo-label" style={{ background: TIER_COLORS[tier] }}>
              {tier}
            </span>
            <div className="tier-demo-slots">
              {DEMO_ITEMS.map((item, i) => ({ ...item, i }))
                .filter((item) => item.tier === tier && item.i < visibleCount)
                .map((item) =>
                  item.imageUrl ? (
                    <span key={item.title} className="tier-demo-poster" title={item.title}>
                      <img src={item.imageUrl} alt={item.title} />
                    </span>
                  ) : (
                    <span key={item.title} className="tier-demo-chip">
                      {item.title}
                    </span>
                  )
                )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TierDemo;
