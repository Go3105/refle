'use client';

import { useState } from 'react';
import Image from 'next/image';
import AccountMenu from './components/AccountMenu';
import RealtimeConversation from './components/RealtimeConversation';

export default function Page() {
    const [showConversation, setShowConversation] = useState(false);

    const handleStartReflection = () => {
        setShowConversation(true);
    };

    return (
        <main className="flex flex-col h-screen">
            <div className="absolute top-4 right-4">
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
                </div>
            ) : (
                // リアルタイム会話画面
                <RealtimeConversation />
            )}
        </main>
    );
}

declare global {
    interface Window {
        SpeechRecognition: any;
        webkitSpeechRecognition: any;
    }
}
