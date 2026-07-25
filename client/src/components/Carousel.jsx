import { useState, useEffect } from 'react';

const Carousel = ({ items, renderItem, autoMs = 4000, className = '' }) => {
  const [index, setIndex] = useState(0);

  // Auto-advance, paused implicitly whenever there's only one (or zero)
  // slides -- no point animating a carousel that can't move.
  useEffect(() => {
    if (items.length <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % items.length), autoMs);
    return () => clearInterval(t);
  }, [items.length, autoMs]);

  // Clamp index if the underlying item list shrinks (e.g. re-fetched).
  useEffect(() => {
    if (index >= items.length) setIndex(0);
  }, [items.length, index]);

  if (items.length === 0) {
    return <p className="tier-muted carousel-empty">Nothing to show yet.</p>;
  }

  return (
    <div className={`carousel ${className}`}>
      <div className="carousel-track" style={{ transform: `translateX(-${index * 100}%)` }}>
        {items.map((item, i) => (
          <div key={item.id ?? i} className="carousel-slide">
            {renderItem(item)}
          </div>
        ))}
      </div>

      {items.length > 1 && (
        <div className="carousel-dots">
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              className={`carousel-dot ${i === index ? 'is-active' : ''}`}
              onClick={() => setIndex(i)}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Carousel;
