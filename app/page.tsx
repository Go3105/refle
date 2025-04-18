'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import AccountMenu from './components/AccountMenu';
import RealtimeConversation from './components/RealtimeConversation';
import { SignOutButton } from './components/SignOutButton';

export default function Page() {
    const [showConversation, setShowConversation] = useState(false);

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
                    <Image
                        src="/ai_character.png"
                        width={200}
                        height={200}
                        alt="AI character"
                        className="mb-8"
                    />
                    <button
                        onClick={handleStartReflection}
                        className="mt-4 px-8 py-4 rounded-lg bg-pink-100 font-serif hover:bg-pink-200 text-lg"
                    >
                        今日の振り返りを始めるよ
                    </button>
                    <Link 
                        href="/test"
                        className="mt-4 px-8 py-4 rounded-lg bg-gray-100 font-serif hover:bg-gray-200 text-lg"
                    >
                        検証
                    </Link>
                </div>
            ) : (
                // リアルタイム会話画面
                <RealtimeConversation />
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
