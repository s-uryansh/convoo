'use client';
import React, { useEffect, useRef } from 'react';

type Props = {
  roomName: string;
  displayName?: string;
  onClose: () => void;
};

export default function JitsiModal({ roomName, displayName, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const apiRef = useRef<any>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if ((window as any).JitsiMeetExternalAPI) return;
      return new Promise<void>((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://meet.jit.si/external_api.js';
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('Failed to load Jitsi script'));
        document.body.appendChild(s);
      });
    };

    load()
      .then(() => {
        if (!mounted || !containerRef.current) return;
        const domain = 'meet.jit.si';
        const options = {
          roomName,
          parentNode: containerRef.current,
          width: '100%',
          height: '100%',
          userInfo: { displayName },
          interfaceConfigOverwrite: {
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
          },
        };
        apiRef.current = new (window as any).JitsiMeetExternalAPI(domain, options);
        apiRef.current.addEventListener('readyToClose', onClose);
      })
      .catch((err) => {
        console.error(err);
        // fallback: open Jitsi in new tab if script blocked
        window.open(`https://meet.jit.si/${encodeURIComponent(roomName)}#userInfo.displayName="${encodeURIComponent(displayName || '')}"`, '_blank');
        onClose();
      });

    return () => {
      mounted = false;
      if (apiRef.current) {
        try { apiRef.current.dispose(); } catch {}
        apiRef.current = null;
      }
    };
  }, [roomName, displayName, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="relative w-full max-w-5xl h-[80vh] bg-black rounded overflow-hidden">
        <div ref={containerRef} className="w-full h-full" />
        <button
          onClick={() => {
            if (apiRef.current) {
              try { apiRef.current.executeCommand('hangup'); } catch { onClose(); }
            } else {
              onClose();
            }
          }}
          className="absolute top-3 right-3 px-3 py-1 rounded bg-red-600 text-white"
        >
          End
        </button>
      </div>
    </div>
  );
}
