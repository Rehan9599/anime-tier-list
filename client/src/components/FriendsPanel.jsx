import { useState, useEffect, useCallback } from 'react';
import axiosClient from '../api/axiosClient';

const STATUS_LABEL = {
  pending_sent: 'Pending',
  pending_received: 'Respond below',
  friends: 'Friends',
};

const FriendsPanel = ({ onClose }) => {
  const [tab, setTab] = useState('search'); // 'search' | 'requests' | 'friends'
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [requests, setRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [message, setMessage] = useState('');

  const loadRequests = useCallback(() => {
    axiosClient.get('/api/friends/requests').then((res) => setRequests(res.data.requests));
  }, []);
  const loadFriends = useCallback(() => {
    axiosClient.get('/api/friends').then((res) => setFriends(res.data.friends));
  }, []);

  useEffect(() => {
    loadRequests();
    loadFriends();
  }, [loadRequests, loadFriends]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      axiosClient
        .get(`/api/friends/search?q=${encodeURIComponent(query)}`)
        .then((res) => setResults(res.data.users));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const sendRequest = async (userId) => {
    try {
      const res = await axiosClient.post('/api/friends/request', { userId });
      setMessage(res.data.message);
      setResults((prev) => prev.map((u) => (u.id === userId ? { ...u, status: res.data.status } : u)));
      if (res.data.status === 'friends') loadFriends();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Could not send request.');
    }
  };

  const respond = async (requestId, accept) => {
    try {
      await axiosClient.post(`/api/friends/requests/${requestId}/respond`, { accept });
      loadRequests();
      if (accept) loadFriends();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Could not respond to request.');
    }
  };

  return (
    <div className="tier-modal-backdrop" onClick={onClose}>
      <div className="tier-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tier-modal-header">
          <h2>Friends</h2>
          <button type="button" className="tier-stack-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="tier-controls">
          <button className={`tier-control ${tab === 'search' ? 'is-active' : ''}`} onClick={() => setTab('search')}>
            Search
          </button>
          <button className={`tier-control ${tab === 'requests' ? 'is-active' : ''}`} onClick={() => setTab('requests')}>
            Requests{requests.length > 0 ? ` (${requests.length})` : ''}
          </button>
          <button className={`tier-control ${tab === 'friends' ? 'is-active' : ''}`} onClick={() => setTab('friends')}>
            Friends
          </button>
        </div>

        {message && <p className="tier-error">{message}</p>}

        {tab === 'search' && (
          <div>
            <input
              className="tier-search"
              placeholder="Search by username..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <ul className="tier-friend-list">
              {results.map((u) => (
                <li key={u.id} className="tier-friend-row">
                  <span>{u.username}</span>
                  {u.status === 'none' ? (
                    <button className="tier-control" onClick={() => sendRequest(u.id)}>
                      Add
                    </button>
                  ) : (
                    <span className="tier-muted">{STATUS_LABEL[u.status]}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === 'requests' && (
          <ul className="tier-friend-list">
            {requests.length === 0 && <li className="tier-muted">No pending requests.</li>}
            {requests.map((r) => (
              <li key={r.id} className="tier-friend-row">
                <span>{r.from.username}</span>
                <span>
                  <button className="tier-control" onClick={() => respond(r.id, true)}>
                    Accept
                  </button>
                  <button className="tier-control" onClick={() => respond(r.id, false)}>
                    Decline
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        {tab === 'friends' && (
          <ul className="tier-friend-list">
            {friends.length === 0 && <li className="tier-muted">No friends yet.</li>}
            {friends.map((f) => (
              <li key={f.id} className="tier-friend-row">
                <span>{f.username}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default FriendsPanel;
