'use client';
import React from 'react';

type Props = {
  members: string[];
  avatars: Record<string,string>;
};

export default function MembersSidebar({ members, avatars }: Props) {
  return (
    <aside className="w-64 bg-gray-800 p-4 overflow-y-auto border-r border-gray-700">
      <h3 className="text-xl font-semibold mb-4">Members</h3>
      <ul className="space-y-2">
        {members.map(name => (
          <li key={name} className="flex items-center space-x-3 p-2 bg-gray-700 rounded hover:bg-gray-600 transition-colors">
            <img src={avatars[name] || '/pfp/1.png'} alt={name} className="w-8 h-8 rounded-full object-cover" />
            <span>{name}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}