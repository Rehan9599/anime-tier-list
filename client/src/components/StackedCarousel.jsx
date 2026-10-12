import { useState, useEffect, useRef, useCallback } from 'react';
import { MdKeyboardArrowUp, MdKeyboardArrowDown } from 'react-icons/md';

const StackedCarousel = ({ title, items = [], renderItem, autoMs = 2200 }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [spinDir, setSpinDir] = useState('down'); // 'down' | 'up'
  const [isSpinning, setIsSpinning] = useState(false);
  const isSpinningRef = useRef(false);
  const spinTimeoutRef = useRef(null);
  

  const triggerSpin = useCallback((dir = 'down') => {
    if (items.length <= 1 || isSpinningRef.current) return;

    isSpinningRef.current = true;
    setSpinDir(dir);
    setIsSpinning(true);
    setCurrentIndex((prev) => {
      if (dir === 'down') return (prev + 1) % items.length;
      return (prev - 1 + items.length) % items.length;
    });

    clearTimeout(spinTimeoutRef.current);
    spinTimeoutRef.current = setTimeout(() => {
      isSpinningRef.current = false;
      setIsSpinning(false);
      spinTimeoutRef.current = null;
    }, 420);
  }, [items.length]);
  useEffect(() => {
    if (items.length <= 1) return;
    const interval = setInterval(() => {
      triggerSpin('down');
    }, autoMs);
    return () => clearInterval(interval);
  }, [items.length, autoMs, triggerSpin]);
  useEffect(() => {
    return () => {
      clearTimeout(spinTimeoutRef.current);
      spinTimeoutRef.current = null;
      isSpinningRef.current = false;
    };
  }, []);
  const handleNext = () => triggerSpin('down');
  const handlePrev = () => triggerSpin('up');

  if (items.length === 0) {
    return (
      <div className="stacked-carousel-column">
        <h3 className="dash-section-title">{title}</h3>
        <div className="stacked-deck-wrapper">
          <div className="stacked-deck stacked-deck--empty">
            <p className="tier-muted">No items available</p>
          </div>
        </div>
      </div>
    );
  }

  const getItemAt = (offset) => {
    const idx = (currentIndex + offset + items.length * 100) % items.length;
    return items[idx];
  };

  const topPeek2 = items.length > 2 ? getItemAt(-2) : null;
  const topPeek1 = items.length > 1 ? getItemAt(-1) : null;
  const mainItem = items[currentIndex];
  const bottomPeek1 = items.length > 1 ? getItemAt(1) : null;
  const bottomPeek2 = items.length > 2 ? getItemAt(2) : null;

  return (
    <div className="stacked-carousel-column">
      <h3 className="dash-section-title">{title}</h3>
      <div className="stacked-deck-wrapper">
        {items.length > 1 && (
          <button
            type="button"
            className="stacked-arrow stacked-arrow--up"
            onClick={handlePrev}
            aria-label="Previous card"
          >
            <MdKeyboardArrowUp size={20} />
          </button>
        )}

        <div className="stacked-deck">
          {/* Top Peek Strip 2 (furthest back top) */}
          {topPeek2 && (
            <div
              className="peek-strip peek-strip--top-2"
              onClick={handlePrev}
            />
          )}

          {/* Top Peek Strip 1 (closer top) */}
          {topPeek1 && (
            <div
              className="peek-strip peek-strip--top-1"
              onClick={handlePrev}
            />
          )}

          {/* Active 3D Spinning Front Card */}
          <div
            key={currentIndex}
            className={`stacked-main-card ${
              isSpinning ? (spinDir === 'down' ? 'is-spinning-down' : 'is-spinning-up') : ''
            }`}
          >
            {renderItem(mainItem)}
          </div>

          {/* Bottom Peek Strip 1 (closer bottom) */}
          {bottomPeek1 && (
            <div
              className="peek-strip peek-strip--bottom-1"
              onClick={handleNext}
            />
          )}

          {/* Bottom Peek Strip 2 (furthest back bottom) */}
          {bottomPeek2 && (
            <div
              className="peek-strip peek-strip--bottom-2"
              onClick={handleNext}
            />
          )}
        </div>

        {items.length > 1 && (
          <button
            type="button"
            className="stacked-arrow stacked-arrow--down"
            onClick={handleNext}
            aria-label="Next card"
          >
            <MdKeyboardArrowDown size={20} />
          </button>
        )}
      </div>
    </div>
  );
};

export default StackedCarousel;
