import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import ChatThread from './ChatThread';

const STATUS_LABEL = {
  pending_sent: 'Pending',
  pending_received: 'Respond in Requests',
  friends: 'Friends',
};

// `tab` is controlled by the parent (DashboardPage) so the notification
// bell can jump straight to the Requests tab. `chatFriend` being set
// swaps this whole pane into a chat thread instead of the friends list --
// same controlled pattern, so closing chat from elsewhere is possible too.
const FriendsSidebar = ({
  tab,
  onTabChange,
  chatFriend,
  onOpenChat,
  onCloseChat,
  onRequestsChanged,
  myUserId,
  onCloseDrawer,
}) => {
  const navigate = useNavigate();
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
    if (tab !== 'add' || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      axiosClient
        .get(`/api/friends/search?q=${encodeURIComponent(query)}`)
        .then((res) => setResults(res.data.users));
    }, 300);
    return () => clearTimeout(t);
  }, [tab, query]);

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
      onRequestsChanged?.();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Could not respond to request.');
    }
  };

  if (chatFriend) {
    return (
      <aside className="friends-sidebar friends-sidebar--chat">
        <ChatThread friend={chatFriend} myUserId={myUserId} onBack={onCloseChat} />
      </aside>
    );
  }

  return (
    <aside className="friends-sidebar">
      {onCloseDrawer && (
        <div className="friends-sidebar-header">
          <div>
            <p className="friends-sidebar-kicker">Chat</p>
            <h2 className="friends-sidebar-title">Messages</h2>
          </div>
          <button type="button" className="tier-stack-close" onClick={onCloseDrawer} aria-label="Close chat drawer">
            ×
          </button>
        </div>
      )}

      <div className="friends-sidebar-tabs">
        <button className={`friends-tab ${tab === 'add' ? 'is-active' : ''}`} onClick={() => onTabChange('add')}>
          Add Friend
        </button>
        <button className={`friends-tab ${tab === 'requests' ? 'is-active' : ''}`} onClick={() => onTabChange('requests')}>
          Requests{requests.length > 0 ? ` (${requests.length})` : ''}
        </button>
        <button className={`friends-tab ${tab === 'friends' ? 'is-active' : ''}`} onClick={() => onTabChange('friends')}>
          Friends
        </button>
      </div>

      {message && <p className="tier-error">{message}</p>}

      {tab === 'add' && (
        <div className="friends-sidebar-body">
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
        <div className="friends-sidebar-body">
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
        </div>
      )}

      {tab === 'friends' && (
        <div className="friends-sidebar-body">
          <ul className="tier-friend-list">
            {friends.length === 0 && <li className="tier-muted">No friends yet -- add some!</li>}
            {friends.map((f) => (
              <li key={f.id} className="friend-row-expanded">
                <span className="friend-row-name">{f.username}</span>
                <span className="friend-row-actions">
                  <button className="tier-control" onClick={() => navigate(`/friend/${f.id}`)}>
                    Profile
                  </button>
                  <button className="tier-control" onClick={() => onOpenChat(f)}>
                    Chat
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
};

export default FriendsSidebar;
