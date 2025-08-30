'use client';
import React from 'react';
import { IMessage } from '@/types';

type Props = { messages: IMessage[] };

export default function MessageList({ messages }: Props) {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-2">
      {messages.map(m => (
        <div key={m._id} className="flex flex-col">
          <span className="text-sm text-gray-400">{m.sender}</span>
          <span>{m.text}</span>
        </div>
      ))}
    </div>
  );
}