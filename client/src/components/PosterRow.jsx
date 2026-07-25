// A simple scrollable row -- each card keeps its natural poster aspect
// ratio (2:3) instead of one image being stretched to fill a wide box,
// which is what was distorting the artwork in the single-slide carousel.
const PosterRow = ({ items, renderItem }) => {
  if (items.length === 0) {
    return <p className="tier-muted carousel-empty">Nothing to show yet.</p>;
  }

  return (
    <div className="poster-row">
      {items.map((item, i) => (
        <div key={item.id ?? i} className="poster-row-item">
          {renderItem(item)}
        </div>
      ))}
    </div>
  );
};

export default PosterRow;
