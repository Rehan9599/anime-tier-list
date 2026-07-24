import { useState, useEffect, useRef } from 'react';
import axiosClient from '../api/axiosClient';
import socket from '../socket';

const ChatWidget = ({ friendId, friendUsername, myUserId }) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const scrollRef = useRef(null);

  // Join this friend's conversation room on mount, leave it on unmount
  // (or if friendId changes) -- since the socket is a shared singleton,
  // without an explicit leave it would keep receiving this conversation's
  // messages even after navigating away from it.
  useEffect(() => {
    socket.emit('chat:join', { friendId });

    axiosClient.get(`/api/chat/${friendId}`).then((res) => setMessages(res.data.messages));

    const handleMessage = (msg) => setMessages((prev) => [...prev, msg]);
    socket.on('chat:message', handleMessage);

    return () => {
      socket.emit('chat:leave', { friendId });
      socket.off('chat:message', handleMessage);
    };
  }, [friendId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open]);

  const send = () => {
    if (!text.trim()) return;
    socket.emit('chat:message', { friendId, text: text.trim() });
    setText('');
  };

  if (!open) {
    return (
      <button type="button" className="chat-bubble" onClick={() => setOpen(true)}>
        💬 {friendUsername}
      </button>
    );
  }

  return (
    <div className="chat-panel">
      <div className="chat-panel-header">
        <span>{friendUsername}</span>
        <button type="button" className="tier-stack-close" onClick={() => setOpen(false)} aria-label="Close chat">
          ×
        </button>
      </div>

      <div className="chat-panel-messages" ref={scrollRef}>
        {messages.map((m) => (
          <div key={m.id} className={`chat-message ${String(m.from) === String(myUserId) ? 'chat-message--mine' : ''}`}>
            {m.text}
          </div>
        ))}
      </div>

      <div className="chat-panel-input">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Message..."
        />
        <button type="button" onClick={send}>
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatWidget;
