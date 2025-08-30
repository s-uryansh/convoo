'use client';
import React from 'react';

type Toast = { id: string; message: string };

type Props = { toasts: Toast[] };

export default function ToastContainer({ toasts }: Props) {
  return (
    <div className="fixed top-4 right-4 space-y-2 z-50">
      {toasts.map(t => (
        <div key={t.id} className="px-4 py-2 bg-gray-700 text-white rounded shadow-lg animate-fade-in">
          {t.message}
        </div>
      ))}
    </div>
  );
}