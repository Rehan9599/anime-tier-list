import { useState, useEffect, useRef } from 'react';
import { MdArrowBack } from 'react-icons/md';
import axiosClient from '../api/axiosClient';
import socket from '../socket';

const ChatThread = ({ friend, myUserId, onBack }) => {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const scrollRef = useRef(null);

  // Joins this friend's room on mount, leaves it on unmount/friend switch --
  // since the socket is a shared singleton, without an explicit leave it'd
  // keep receiving this conversation's messages after switching away.
  useEffect(() => {
    socket.emit('chat:join', { friendId: friend.id });
    axiosClient.get(`/api/chat/${friend.id}`).then((res) => setMessages(res.data.messages));

    const handleMessage = (msg) => setMessages((prev) => [...prev, msg]);
    socket.on('chat:message', handleMessage);

    return () => {
      socket.emit('chat:leave', { friendId: friend.id });
      socket.off('chat:message', handleMessage);
    };
  }, [friend.id]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const send = () => {
    if (!text.trim()) return;
    socket.emit('chat:message', { friendId: friend.id, text: text.trim() });
    setText('');
  };

  return (
    <div className="chat-thread">
      <div className="chat-thread-header">
        <button type="button" className="chat-thread-back" onClick={onBack} aria-label="Back to friends">
          <MdArrowBack size={20} />
        </button>
        <span className="chat-thread-name">{friend.username}</span>
      </div>

      <div className="chat-thread-messages" ref={scrollRef}>
        {messages.map((m) => (
          <div
            key={m.id}
            className={`chat-message ${String(m.from) === String(myUserId) ? 'chat-message--mine' : ''}`}
          >
            {m.text}
          </div>
        ))}
      </div>

      <div className="chat-thread-input">
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

export default ChatThread;
