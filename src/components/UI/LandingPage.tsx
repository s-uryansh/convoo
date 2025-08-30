'use client';

import React, {useState, useEffect} from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export default function LandingPage(){
    const [joinModalOpen, setJoinModalOpen] = useState(false);
    const [joinRoomId, setJoinRoomId] = useState('');
    const router = useRouter()
    const [username, setUsername] = useState('');
    const [avatar, setAvatar] = useState<string | null>(null);

    useEffect(() => {
      const avatars = ['/pfp/1.jpg', '/pfp/2.jpg', '/pfp/3.jpg'];
      const pick = avatars[Math.floor(Math.random() * avatars.length)];
      setAvatar(pick);
    }, []);

    //Create Room logic
    const handleCreate = async () => {
        if (!username){
            return;
        }
        try{
            const res = await fetch('/api/rooms', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ creator: username }),
            });
            const {roomId} = await res.json();
            localStorage.setItem('justCreatedRoom', 'true');
            router.push(`/room/${roomId}?username=${encodeURIComponent(username)}`);
        } catch (error) {
            console.error("Error creating room:", error);
        }
    }

    const openJoinModal = () => setJoinModalOpen(true);

    //Join Room logic
    const handleJoin = () => {
        if(joinRoomId.trim()){
            router.push(`/room/${joinRoomId}?username=${encodeURIComponent(username)}`);
            setJoinModalOpen(false);
        }
        else {
            alert("Room ID is required to join a room.");
        }
    }

    return(
        <div className="flex h-screen bg-gray-900 text-white">
            {/* side bar */}
            <div className="w-1/3 p-8 flex flex-col items-center bg-gray-800">
                <div className="w-32 h-32 rounded-full bg-gray-700 mb-6 flex items-center justify-center">
                    <Image
                      src={avatar ?? '/pfp/1.jpg'}
                      alt="User Avatar"
                      width={100}
                      height={100}
                      className="rounded-full object-cover"
                    />
                </div>
                <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                    className="w-full p-2 rounded bg-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                {/* middle area */}
                <div className="flex-1 flex flex-col justify-center items-center">

                    {/* Project Name */}
                    <h1 className="text-6xl font-bold mb-8">Convoo</h1> 
                    <div className="space-x-4">
                        <button
                            onClick={openJoinModal}
                            disabled={!username}
                            className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50"
                        >
                                Join Room
                        </button>
                        <button
                            onClick={handleCreate}
                            disabled={!username}
                            className="px-6 py-3 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-50"
                        >
                                Create Room
                        </button>
                    </div>
                </div>
                {/* Modals */}

                {/* Join */}
                {joinModalOpen && (
                    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-75">
                        <div className="bg-gray-800 p-6 rounded-lg w-80">
                            <h2 className='text-xl mb-4'>Enter Room Id</h2>
                            <input
                                type="text"
                                value={joinRoomId}
                                onChange={(e) => setJoinRoomId(e.target.value)}
                                placeholder="Room ID"
                                className="w-full p-2 rounded bg-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                            />
                            <div className="flex justify-end space-x-2">
                                <button
                                    onClick={() => setJoinModalOpen(false)}
                                    className="px-4 py-2 rounded bg-gray-600 hover:bg-gray-500"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleJoin}
                                    className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50"
                                >
                                    Join
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}