'use client';

import { useState } from 'react';
import Link from 'next/link';
import AccountMenu from './AccountMenu';
import RealtimeConversation from './RealtimeConversation';
import { SignOutButton } from './SignOutButton';
// import { Player } from "@lottiefiles/react-lottie-player";
import Microphoneicon from './Microphoneicon';
import BackgroundAnimation from './BackgroundAnimation';
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
    const [showGreeting, setShowGreeting] = useState(false);
    const { startConversation, resetConversation } = useConversation();

    const greeting = `${userName}さん今日もお疲れ様でした。簡単に1日の出来事を振り返ってみましょう`;

    const handleStartReflection = () => {
        // 会話開始時間を設定
        startConversation();
        console.log('会話を開始します - handleStartReflection');

        setShowGreeting(true);
        setTimeout(() => {
            setShowGreeting(false);
            setShowConversation(true);
        }, 1000 + greeting.length * 70); // 全文字表示後に遷移
    };

    return (
        <main className="flex flex-col h-screen">
            {(!showGreeting && !showConversation) && (
                <div className="w-full h-20 bg-green-400 absolute top-0 left-0 z-0" />
            )}
            {!showConversation ? (
                <div className="flex flex-col justify-center items-center h-full">
                    {showGreeting ? (
                        <div className="absolute w-full h-full z-0 flex items-center justify-center">
                            <BackgroundAnimation />
                            <div className="flex flex-col items-center justify-center w-full h-full absolute top-0 left-0 z-10">
                                <div
                                    className="text-4xl mb-8 whitespace-pre-line zen-maru-gothic-black"
                                    style={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                    }}
                                >
                                    {greeting.split('').map((char, i) => (
                                        <span
                                            key={i}
                                            style={{
                                                opacity: 0,
                                                animation: `fadein-char 0.5s forwards`,
                                                animationDelay: `${i * 0.07}s`,
                                                display: 'inline-block',
                                                color: '#ffffff',
                                                whiteSpace: 'pre',
                                            }}
                                        >
                                            {char}
                                        </span>
                                    ))}
                                </div>
                                <style jsx>{`
                                    @keyframes fadein-char {
                                        to {
                                            opacity: 1;
                                        }
                                    }
                                `}</style>
                            </div>
                        </div>
                    ) : (
                        <>
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
                        </>
                    )}
                </div>
            ) : (
                <UnifiedChatInterface />
            )}
        </main>
    );
}