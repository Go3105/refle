'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import AccountMenu from './components/AccountMenu';
import AudioPlayer from './components/AudioPlayer';

export default function Page() {
    const [showAudio, setShowAudio] = useState(false);
    const welcomeText = 'こんにちは！今日の振り返りを始めましょう。今日はどんな一日でしたか？';

    const handleStartReflection = () => {
        setShowAudio(true);
    };

    return (
        <main className="relative min-h-screen">
            <div className="absolute top-4 right-4">
                <AccountMenu />
            </div>
            <div className="flex justify-center items-center h-screen">
                <div className="text-center">
                    <Image
                        src="/ai_character.png"
                        width={200}
                        height={200}
                        alt="AI character"
                    />
                    {!showAudio ? (
                        <button
                            onClick={handleStartReflection}
                            className="mt-[25vh] block rounded-lg bg-pink-100 px-5 py-5 font-serif hover:bg-pink-200 w-full"
                        >
                            今日の振り返りを始めるよ
                        </button>
                    ) : (
                        <div className="mt-8">
                            <p className="mb-4 text-lg">{welcomeText}</p>
                            <AudioPlayer text={welcomeText} autoPlay={true} />
                            <Link
                                href="/conversation"
                                className="mt-4 block rounded-lg bg-pink-100 px-5 py-3 font-serif hover:bg-pink-200"
                            >
                                振り返りを続ける
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
