/// <reference lib="dom" />
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
  const [isConnecting, setIsConnecting] = useState(false);
  const [userInteracted, setUserInteracted] = useState(false); // New state for interaction

  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Record<string, RTCPeerConnection>>({});
  const initialized = useRef(false);

  const makingOffer = useRef(false);
  const ignoreOffer = useRef(false);
  const politePeers = useRef<Record<string,boolean>>({});

  const iceQueueRef = useRef<Record<string, RTCIceCandidateInit[]>>({});


  const playAudio = async (audioElement: HTMLAudioElement) => {
    try {
      await audioElement.play();
    } catch (error) {
      console.log('Autoplay was prevented, will play on user interaction', error);
    }
  };

  const handleUserInteraction = async () => {
    if (userInteracted) return;
    console.log('User has interacted with the page. Attempting to play all audio.');
    setUserInteracted(true);
  
    const playPromises: Promise<void>[] = [];
    document.querySelectorAll('audio').forEach(audioEl => {
      // Check if the element has a stream and is currently paused
      if (audioEl.srcObject && audioEl.paused) {
         playPromises.push(audioEl.play());
      }
    });
  
    try {
      await Promise.all(playPromises);
     
      
      console.log('All pending audio tracks have been started.');
    } catch (error) {
      console.error('One or more audio elements could not be played after interaction:', error);
      showToast('Could not enable all audio. Please check site permissions.');
    }
  };

  function showToast(message: string) {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3000);
  }


  async function makeOffer(pc: RTCPeerConnection, otherUser: string) {
    try {
      makingOffer.current = true;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketRef.current?.emit('webrtc-offer', { to: otherUser, sdp: offer });
      console.log(`📤 Perfect‐negotiation: sent offer to ${otherUser}`);
    } catch (err) {
      console.error('Error making offer:', err);
    } finally {
      makingOffer.current = false;
    }
  }




  function initializeSocket() {
    if (socketRef.current?.connected || isConnecting) {
      console.log('Socket already connected or connecting');
      return;
    }

    setIsConnecting(true);

    const created = localStorage.getItem('justCreatedRoom');
    if (created) {
      setShowPopup(true);
      localStorage.removeItem('justCreatedRoom');
      
    }
    console.log('Calling initializeSocket at', new Date().toISOString());
    const socket = io({
      path: '/api/socket_io',
      query: {
        roomId,
        username,
      },
      transports:['polling','websocket'],
      forceNew: true,
      reconnection: true,
    });
    
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      setIsConnecting(false);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnecting(false);
    });

    socket.on("room-full", () => {
      socket.disconnect();
      window.location.href = '/';
      showToast("Room is full. Please try another room.");
    });

    socket.on("duplicate-username", () => {
      console.log('Duplicate username detected');
      socket.disconnect();
      showToast("Username already taken in this room.");
      setTimeout(() => {
        window.location.href = "/";
      }, 2000);
    });
    
    socket.on("rapid-reconnection", () => {
        console.log('Rapid reconnection blocked by server.');
        showToast("Connection attempt failed. Please wait a moment.");
        socket.disconnect();
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
      delete iceQueueRef.current[name];
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

    socket.on('webrtc-offer', async ({ from, sdp }) => {
      console.log(`🔥 Received offer from ${from}`);
      const pc = peersRef.current[from];
      if (!pc) {
        console.warn('No PC for offer from', from);
        return;
      }

      // 1) Politeness logic
      if (politePeers.current[from] === undefined) {
        politePeers.current[from] = username < from;
      }
      const isPolite = politePeers.current[from]!;

      // 2) Collision detection
      const offerCollision = makingOffer.current || pc.signalingState !== 'stable';

      // 3) If impolite & collision → ignore
      ignoreOffer.current = !isPolite && offerCollision;
      if (ignoreOffer.current) {
        console.log(`- Ignoring offer from ${from} due to collision`);
        return;
      }

      // 4) *Here* we accept the offer…
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));

      // >>> FLUSH ANY QUEUED ICE CANDIDATES NOW THAT SDP IS APPLIED:
      const queued = iceQueueRef.current[from] || [];
      for (const cand of queued) {
        await pc.addIceCandidate(new RTCIceCandidate(cand));
      }
      iceQueueRef.current[from] = [];

      // 5) …then create & send our answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      console.log(`📤 Perfect‐negotiation: sending answer to ${from}`);
      socketRef.current?.emit('webrtc-answer', { to: from, sdp: answer });
    });



    socket.on('webrtc-answer', async ({ from, sdp }) => {
      console.log(`✅ Received answer from ${from}`);
      const pc = peersRef.current[from];

      if (!pc) {
        console.warn(`No RTCPeerConnection exists for ${from}`);
        return;
      }

      try {
        // 1) Apply the remote SDP
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        console.log(`📥 Remote answer from ${from} successfully applied.`);

        // 2) <<< FLUSH QUEUED ICE CANDIDATES for this peer now that remoteDescription is set
        const queued = iceQueueRef.current[from] || [];
        for (const cand of queued) {
          await pc.addIceCandidate(new RTCIceCandidate(cand));
        }
        iceQueueRef.current[from] = [];

      } catch (err) {
        console.warn(`⚠️ Failed to apply remote answer from ${from} on first attempt:`, err);

        // Retry after short delay in case of race
        setTimeout(async () => {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(sdp));
            console.log(`✅ Remote answer from ${from} successfully applied on retry.`);

            // 3) <<< ALSO FLUSH QUEUED ICE HERE on retry
            const queuedRetry = iceQueueRef.current[from] || [];
            for (const cand of queuedRetry) {
              await pc.addIceCandidate(new RTCIceCandidate(cand));
            }
            iceQueueRef.current[from] = [];

          } catch (retryErr) {
            console.error(`❌ Retry also failed applying remote answer from ${from}:`, retryErr);
          }
        }, 100);
      }
    });



    socket.on('webrtc-candidate', async ({ from, candidate }) => {
      const pc = peersRef.current[from];
      if (!pc) return;

      // if we haven’t applied remote SDP yet, queue it
      if (!pc.remoteDescription) {
        iceQueueRef.current[from] = iceQueueRef.current[from] || [];
        iceQueueRef.current[from].push(candidate);
        return;
      }

      // otherwise, safe to apply
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    });


    return () => {
      console.log('Cleaning up socket connection');
      socket.disconnect();
      Object.values(peersRef.current).forEach((pc) => pc.close());
      peersRef.current = {};
      Object.keys(iceQueueRef.current).forEach((peer) => {
        delete iceQueueRef.current[peer];
      });

      setIsConnecting(false);
    };
  }

  useEffect(() => {
    console.log('useEffect mount at', new Date().toISOString());

    // <<< CHANGED: initialize socket immediately, before any async/mic gating
    const cleanupSocket = initializeSocket();

    // <<< CHANGED: request mic in parallel (no await holding up socket init)
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        console.log('Microphone access granted, tracks:', stream.getTracks().length);
        localStreamRef.current = stream;
      })
      .catch(error => {
        console.error('Failed to get microphone access:', error);
        showToast('Failed to access microphone');
      });

    return () => {
      console.log('Component unmounting, cleaning up…');

      // <<< CHANGED: always tear down socket on unmount
      cleanupSocket?.();

      // stop and clear local tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
    };
  }, [roomId, username]);


  useEffect(() => {
    // 1) Find anyone new you haven’t yet set up
    const newcomers = members.filter(u => u !== username && !peersRef.current[u]);

    newcomers.forEach(otherUser => {
      if (!localStreamRef.current) return;

      // 2) Create the RTCPeerConnection and store it
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      peersRef.current[otherUser] = pc;

      // 3) Decide politeness (who initiates)
      if (politePeers.current[otherUser] === undefined) {
        politePeers.current[otherUser] = username < otherUser;
      }
      const isPolite = politePeers.current[otherUser]!;

      // 4) Wire up ICE‐candidate forwarding
      pc.onicecandidate = e => {
        if (e.candidate) {
          socketRef.current?.emit('webrtc-candidate', {
            to: otherUser,
            candidate: e.candidate
          });
        }
      };

      // 5) Handle incoming tracks
      pc.ontrack = e => {
        const audioEl = document.getElementById(`audio-${otherUser}`) as HTMLAudioElement;
        if (audioEl) {
          audioEl.srcObject = e.streams[0];
          if (userInteracted) playAudio(audioEl);
        }
      };

      // 6) Add your local audio tracks
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });

      // 7) **Only** the polite peer makes the first offer
      if (isPolite) {
        makeOffer(pc, otherUser);
      }
    });
  }, [members, username]);


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
    if(typeof navigator !== 'undefined' && navigator.clipboard?.writeText){
      navigator.clipboard.writeText(roomId);
    }else{
      console.warn('Clipboard API not supported');
    }
    setCopied(true);
  };

  const handleExitRoom = () => {
    console.log('Exiting room...');
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    Object.values(peersRef.current).forEach((pc) => pc.close());
    
    window.location.href = '/';
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {!userInteracted && (
        <div
          onClick={handleUserInteraction}
          className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 cursor-pointer"
        >
          <div className="text-center p-4">
            <h2 className="text-2xl font-bold mb-2">Tap to Enable Audio</h2>
            <p className="text-gray-300">Your browser requires interaction before playing sound.</p>
          </div>
        </div>
      )}
      
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
                  <audio
                    id={`audio-${member}`}
                    autoPlay
                    playsInline
                    style={{ display: 'none' }}
                  />
                </li>
              ))}
            </ul>
        </div>

        <div className="flex-1 flex flex-col">
          <header className="p-4 bg-gray-800 flex justify-between items-center">
            <h2 className="text-lg font-semibold">Chat Room: {roomId}</h2>
            <span>Welcome, {username}!</span>
            <button
              onClick={handleExitRoom}
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
