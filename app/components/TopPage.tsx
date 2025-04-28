'use client';

import { useState } from 'react';
import Link from 'next/link';
import AccountMenu from './AccountMenu';
import { SignOutButton } from './SignOutButton';
import Microphoneicon from './Microphoneicon';
import { DynaPuff } from 'next/font/google';
import UnifiedChatInterface from './UnifiedChatInterface';
import { useConversation } from '../context/ConversationContext';

const dynaPuff = DynaPuff({
    subsets: ['latin'],
    display: 'swap',
});

export default function TopPage({ username }: { username: string }) {
    const userName = username;
    const [showConversation, setShowConversation] = useState(false);
    const [micHover, setMicHover] = useState(false);
    const { startConversation, resetConversation } = useConversation();

    const handleStartReflection = () => {
        startConversation();
        setShowConversation(true);
    };

    return (
        <main className="flex flex-col h-screen">
            {!showConversation && (
                <div className="w-full h-20 bg-green-400 absolute top-0 left-0 z-0" />
            )}
            {!showConversation ? (
                <div className="flex flex-col justify-center items-center h-full">
                    <div className={`absolute top-5 left-20 text-white text-4xl ${dynaPuff.className}`}>
                        Refle
                    </div>
                    <div className="absolute top-4 right-20 flex items-center z-20">
                        <SignOutButton />
                    </div>
                    <div className="absolute top-4 right-6 flex items-center z-20">
                        <AccountMenu />
                    </div>
                    <button
                        onClick={handleStartReflection}
                        onMouseEnter={() => setMicHover(true)}
                        onMouseLeave={() => setMicHover(false)}
                        style={{
                            filter: micHover
                                ? 'hue-rotate(30deg)'
                                : 'none',
                        }}
                    >
                        <Microphoneicon />
                    </button>
                </div>
            ) : (
                <UnifiedChatInterface />
            )}
        </main>
    );
}