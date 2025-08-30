'use client';
import React from 'react';

type Props = { text: string; setText: (t: string) => void; onSend: (e: React.FormEvent) => void };

export default function MessageInput({ text, setText, onSend }: Props) {
  return (
    <form onSubmit={onSend} className="flex p-4 bg-gray-800">
      <input
        type="text"
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Type your message..."
        className="flex-1 p-2 rounded bg-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 mr-2"
      />
      <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded">
        Send
      </button>
    </form>
  );
}