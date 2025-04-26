'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import AccountMenu from './components/AccountMenu';
import { SignOutButton } from './components/SignOutButton';
// import { Player } from "@lottiefiles/react-lottie-player";
import Microphoneicon from './components/ui/Microphoneicon';
import UnifiedChatInterface from './components/UnifiedChatInterface';

export default function Page() {
    const [showConversation, setShowConversation] = useState(false);
    const [micHover, setMicHover] = useState(false);

    const handleStartReflection = () => {
        setShowConversation(true);
    };

    return (
        <main className="flex flex-col h-screen">
            <div className="absolute top-4 right-4 flex items-center">
                <SignOutButton className="mr-4" />
                <AccountMenu />
            </div>

            {!showConversation ? (
                // 初期画面
                <div className="flex flex-col justify-center items-center h-full">
                    <button
                        onClick={handleStartReflection}
                        onMouseEnter={() => setMicHover(true)}
                        onMouseLeave={() => setMicHover(false)}
                        style={{
                            filter: micHover ? 'brightness(1.2) sepia(0.4) hue-rotate(30deg) saturate(2)' : 'none',
                        }}
                    >
                        <Microphoneicon />
                    </button>
                </div>
            ) : (
                // 統合されたチャットインターフェース
                <UnifiedChatInterface />
            )}
        </main>
    );
}

// Web Speech API 型定義（最低限）
interface MySpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    running: boolean;
    startPending: boolean;
    start(): void;
    stop(): void;
    onresult: ((event: Event) => void) | null;
    onend: (() => void) | null;
    onaudioend: (() => void) | null;
    onspeechstart: (() => void) | null;
    onspeechend: (() => void) | null;
}
