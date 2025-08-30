'use client';
import React from 'react';

type Props = {
  roomId: string;
  username: string;
  onExit: () => void;
  onStartVideo?: () => void;
};

export default function ChatHeader({ roomId, username, onExit, onStartVideo }: Props) {
  return (
    <div className="flex items-center justify-between p-4 bg-gray-800">
      <div>
        <h2 className="text-lg font-semibold">Room: {roomId}</h2>
        <span className="text-sm text-gray-400">{username}</span>
      </div>
      <div className="flex gap-2">
        <button onClick={onStartVideo} className="px-3 py-1 bg-green-600 rounded">Video</button>
        <button onClick={onExit} className="px-3 py-1 bg-red-600 rounded">Exit</button>
      </div>
    </div>
  );
}
