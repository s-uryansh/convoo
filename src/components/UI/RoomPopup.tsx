'use client';
import React from 'react';

type RoomPopupProps = {
  roomId: string;
  copied: boolean;
  onCopy: () => void;
  onClose: () => void;
};

export default function RoomPopup({ roomId, copied, onCopy, onClose }: RoomPopupProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 z-50">
      <div className="bg-gray-800 p-6 rounded-lg text-center w-80">
        <h2 className="text-2xl mb-4">Room Created</h2>
        <div className="flex items-center justify-center mb-4">
          <span className="font-mono bg-gray-700 px-3 py-1 rounded mr-2">{roomId}</span>
          <button
            onClick={onCopy}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded"
        >
          Close
        </button>
      </div>
    </div>
  );
}