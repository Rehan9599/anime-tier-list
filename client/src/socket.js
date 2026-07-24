import { io } from 'socket.io-client';

// One shared connection for the whole app -- created once, reused
// everywhere a component needs to emit/listen, instead of opening a new
// socket per component (which would multiply connections and messages).
const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000', {
  withCredentials: true, // sends the httpOnly JWT cookie during the handshake
  autoConnect: true,
});

export default socket;
