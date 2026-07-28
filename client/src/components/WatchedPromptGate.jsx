import { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import SwipeDeck from './SwipeDeck';

// Shows the watched-anime swipe quiz at most once per browser session --
// sessionStorage (not localStorage) so it reappears next time they
// actually log in again, but doesn't nag on every page navigation within
// the same session.
const WatchedPromptGate = () => {
  const [items, setItems] = useState(null); // null = haven't checked yet

  useEffect(() => {
    if (sessionStorage.getItem('watchedPromptShown')) return;
    sessionStorage.setItem('watchedPromptShown', '1');

    axiosClient.get('/api/watched/prompt').then((res) => setItems(res.data.items));
  }, []);

  if (!items || items.length === 0) return null;
  return <SwipeDeck items={items} onClose={() => setItems([])} />;
};

export default WatchedPromptGate;
