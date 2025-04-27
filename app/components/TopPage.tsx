'use client';

import { useState } from 'react';
import Link from 'next/link';
import AccountMenu from './AccountMenu';
import RealtimeConversation from './RealtimeConversation';
import { SignOutButton } from './SignOutButton';
// import { Player } from "@lottiefiles/react-lottie-player";
import Microphoneicon from './Microphoneicon';
import { DynaPuff } from 'next/font/google';

const dynaPuff = DynaPuff({
    subsets: ['latin'],
    display: 'swap',
});

export default function TopPage({ username }: { username: string }) {
    const userName = username;
    const [showConversation, setShowConversation] = useState(false);
    const [micHover, setMicHover] = useState(false);
    const [showGreeting, setShowGreeting] = useState(false);

    const greeting = `${userName}さん今日もお疲れ様でした。簡単に1日の出来事を振り返ってみましょう`;

    const handleStartReflection = () => {
        setShowGreeting(true);
        setTimeout(() => {
            setShowGreeting(false);
            setShowConversation(true);
        }, 500 + greeting.length * 50); // 全文字表示後に遷移
    };

    return (
        <main className="flex flex-col h-screen">
            {(!showGreeting && !showConversation) && (
                <div className="w-full h-20 bg-orange-300 absolute top-0 left-0 z-0" />
            )}
            <div className="absolute top-4 right-4 flex items-center z-10">
                <AccountMenu />
            </div>
            {!showConversation ? (
                <div className="flex flex-col justify-center items-center h-full">
                    {showGreeting ? (
                        <div className="text-4xl font-bold mb-8 whitespace-pre-line" style={{ display: 'flex', flexWrap: 'wrap' }}>
                            {greeting.split('').map((char, i) => (
                                <span
                                    key={i}
                                    style={{
                                        opacity: 0,
                                        animation: `fadein-char 0.5s forwards`,
                                        animationDelay: `${i * 0.04}s`,
                                        display: 'inline-block',
                                        color: '#ff8c42',
                                        whiteSpace: 'pre',
                                    }}
                                >
                                    {char}
                                </span>
                            ))}
                            <style jsx>{`
                                @keyframes fadein-char {
                                    to {
                                        opacity: 1;
                                    }
                                }
                            `}</style>
                        </div>
                    ) : (
                        <>
                            <div className={`absolute top-5 left-20 text-white text-4xl ${dynaPuff.className}`}>
                                Refle
                            </div>
                            <div className="absolute top-4 right-20 flex items-center z-20">
                                <SignOutButton className="mr-0" />
                            </div>
                            <button
                                onClick={handleStartReflection}
                                onMouseEnter={() => setMicHover(true)}
                                onMouseLeave={() => setMicHover(false)}
                                style={{
                                    filter: micHover
                                        ? 'hue-rotate(340deg)'
                                        : 'none',
                                }}
                            >
                                <Microphoneicon />
                            </button>
                        </>
                    )}
                </div>
            ) : (
                <RealtimeConversation />
            )}
        </main>
    );
}