'use client';

import React from 'react';
import { useSearchParams, useParams } from 'next/navigation';
import RoomPage from '@/components/RoomPage';

export default function RoomRoute(){
    const params = useParams();
    const searchParams = useSearchParams();

    const roomId = params?.room as string;
    const username = searchParams?.get('username') || '';

    if (!roomId || !username){
        return (
            <div className='flex items-center justify-center h-screen bg-gray-900 text-white'>
                <h1 className='text-2xl'>Room ID and Username are required</h1>
            </div>
        )
    }

    return (
        <RoomPage roomId={roomId} username={username} />
    );
}