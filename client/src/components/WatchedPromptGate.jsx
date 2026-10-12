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

    let mounted = true;

    axiosClient
      .get('/api/watched/prompt')
      .then((res) => {
        if (!mounted) return;

        setItems(res.data.items);

        if (!res.data.items || res.data.items.length === 0) {
          sessionStorage.setItem('watchedPromptShown', '1');
        }
      })
      .catch((err) => {
        if (!mounted) return;

        console.error('Could not load watched prompt:', err);
        setItems([]);
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (!items || items.length === 0) return null;
  return <SwipeDeck items={items} onClose={() => {sessionStorage.setItem('watchedPromptShown', '1');setItems([]);}} />;
};

export default WatchedPromptGate;
