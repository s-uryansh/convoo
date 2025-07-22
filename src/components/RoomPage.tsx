'use client';

import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { IMessage, RoomPageProps } from '@/types';

export default function RoomPage({ roomId, username }: RoomPageProps) {
  type Toast = { id: string; message: string };

  const [showPopup, setShowPopup] = useState(false);
  const [copied, setCopied] = useState(false);
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [text, setText] = useState('');
  const socketRef = useRef<Socket | null>(null);
  const [members, setMembers] = useState<string[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [memberAvatars, setMemberAvatars] = useState<Record<string, string>>({});

  function showToast(message: string) {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3000);
  }

  useEffect(() => {
    const created = localStorage.getItem('justCreatedRoom');
    if (created) {
      setShowPopup(true);
      localStorage.removeItem('justCreatedRoom');
    }

    const socket = io({
      path: '/api/socket_io',
      query: {
        roomId,
        username,
      },
    });
    socketRef.current = socket;

    socket.on("room-full", () => {
      socket.disconnect();
      window.location.href = '/';
      showToast("Room is full. Please try another room.");
    });

    socket.on("duplicate-username", () => {
      socket.disconnect();
      showToast("Username already taken in this room.");
      setTimeout(() => {
        window.location.href = "/";
      }, 2000);
    });

    socket.on('history', (history: IMessage[]) => {
      setMessages(history);
    });

    socket.on('message', (msg: IMessage) => {
      setMessages((msgs) => [...msgs, msg]);
    });

    socket.on('user-joined', (name: string) => {
      showToast(`${name} has joined the room.`);
    });

    socket.on('user-left', (name: string) => {
      showToast(`${name} has left the room.`);
    });

    socket.on('members', (list: string[]) => {
      setMembers(list);

      setMemberAvatars((prev) => {
        const updatedAvatars = { ...prev };
        const availableAvatars = ['/pfp/1.jpg', '/pfp/2.jpg', '/pfp/3.jpg'];

        list.forEach((name) => {
          if (!updatedAvatars[name]) {
            const random = availableAvatars[Math.floor(Math.random() * availableAvatars.length)];
            updatedAvatars[name] = random;
          }
        });

        return updatedAvatars;
      });
    });


    return () => {
      socket.disconnect();
    };
  }, [roomId, username]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    socketRef.current?.emit('message', text);
    setText('');
  };

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  const handleCopy = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {showPopup && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 z-50">
          <div className="bg-gray-800 p-6 rounded-lg text-center w-80">
            <h2 className="text-2xl mb-4">Room Created</h2>
            <div className="flex items-center justify-center mb-4">
              <span className="font-mono bg-gray-700 px-3 py-1 rounded mr-2">
                {roomId}
              </span>
              <button
                onClick={handleCopy}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <button
              onClick={() => setShowPopup(false)}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-row overflow-hidden">
        <div className="w-64 bg-gray-800 p-4 overflow-y-auto border-r border-gray-700">
          <h3 className="text-xl font-semibold mb-4">Members</h3>
            <ul className="space-y-2">
              {members.map((member, index) => (
                <li
                  key={index}
                  className="flex items-center space-x-3 p-2 bg-gray-700 rounded hover:bg-gray-600 transition-colors"
                >
                  <img
                    src={memberAvatars[member] || '/pfp/1.png'}
                    alt="avatar"
                    className="w-8 h-8 rounded-full object-cover"
                  />
                  <span>{member}</span>
                </li>
              ))}
            </ul>
        </div>

        <div className="flex-1 flex flex-col">
          <header className="p-4 bg-gray-800 flex justify-between items-center">
            <h2 className="text-lg font-semibold">Chat Room: {roomId}</h2>
            <span>Welcome, {username}!</span>
            <button
              onClick={() => {
                socketRef.current?.disconnect();
                window.location.href = '/';
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded"
            >
              Exit Room
            </button>
          </header>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {messages.map((m) => (
              <div key={m._id} className="flex flex-col">
                <span className="text-sm text-gray-400">{m.sender}</span>
                <span>{m.text}</span>
              </div>
            ))}
          </div>

          <div className="fixed top-4 right-4 space-y-2 z-50">
            {toasts.map((toast) => (
              <div
                key={toast.id}
                className="px-4 py-2 bg-gray-700 text-white rounded shadow-lg animate-fade-in"
              >
                {toast.message}
              </div>
            ))}
          </div>

          <div className="p-4 bg-gray-800">
            <form onSubmit={sendMessage} className="flex">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 p-2 rounded bg-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 mr-2"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
