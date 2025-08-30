'use client';
import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { IMessage, RoomPageProps } from '@/types';
import RoomPopup from '@/components/UI/RoomPopup';
import MembersSidebar from '@/components/UI/MembersSidebar';
import ChatHeader from '@/components/UI/ChatHeader';
import MessageList from '@/components/Chat/MessageList';
import MessageInput from '@/components/Chat/MessageInput';
import ToastContainer from '@/components/UI/ToastContainer';
import JitsiModal from '@/components/VideoCall/JitsiModal';

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
  const [showVideo, setShowVideo] = useState(false);

  function showToast(message: string) {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }

  useEffect(() => {
    const created = localStorage.getItem('justCreatedRoom');
    if (created) {
      setShowPopup(true);
      localStorage.removeItem('justCreatedRoom');
    }

    const socket = io({ path: '/api/socket_io', query: { roomId, username } });
    socketRef.current = socket;

    socket.on('room-full', () => {
      socket.disconnect();
      window.location.href = '/';
      showToast('Room is full. Please try another room.');
    });

    socket.on('duplicate-username', () => {
      socket.disconnect();
      showToast('Username already taken in this room.');
      setTimeout(() => { window.location.href = '/'; }, 2000);
    });

    socket.on('history', (history: IMessage[]) => {
      setMessages(history);
    });

    socket.on('message', (msg: IMessage) => {
      setMessages((msgs) => [...msgs, msg]);
    });

    socket.on('user-joined', (name: string) => { showToast(`${name} has joined the room.`); });
    socket.on('user-left', (name: string) => { showToast(`${name} has left the room.`); });

    socket.on('members', (list: string[]) => {
      setMembers(list);
      setMemberAvatars((prev) => {
        const updated = { ...prev };
        const avatars = ['/pfp/1.jpg', '/pfp/2.jpg', '/pfp/3.jpg'];
        list.forEach((n) => {
          if (!updated[n]) updated[n] = avatars[Math.floor(Math.random() * avatars.length)];
        });
        return updated;
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [roomId, username]);

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);
  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {showPopup && <RoomPopup roomId={roomId} copied={copied} onCopy={() => { navigator.clipboard.writeText(roomId); setCopied(true); }} onClose={() => setShowPopup(false)} />}
      <div className="flex flex-1 flex-row overflow-hidden">
        <MembersSidebar members={members} avatars={memberAvatars} />
        <div className="flex-1 flex flex-col">
          <ChatHeader 
          roomId={roomId} 
          username={username} 
          onExit={() => { socketRef.current?.disconnect(); window.location.href = '/'; }}
          onStartVideo={() => setShowVideo(true)}
          />
          <MessageList messages={messages} />
          <ToastContainer toasts={toasts} />
          <MessageInput text={text} setText={setText} onSend={e => { e.preventDefault(); socketRef.current?.emit('message', text); setText(''); }} />
        </div>
        {showVideo && (
          <JitsiModal
            roomName={`convoo-${roomId}`}
            displayName={username}
            onClose={() => setShowVideo(false)}
          />
        )}
      </div>
    </div>
  );
}