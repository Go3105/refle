// Googleログインページ
// NextAuthを利用したGoogleログインボタンを表示

'use client'

import { signIn } from 'next-auth/react';
import Image from 'next/image';

export default function LoginPage() {
    const handleLogin = () => {
        signIn('google', { callbackUrl: '/' });
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
            <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md">
                <div className="flex flex-col items-center">
                    <Image
                        src="/ai_character.png"
                        width={120}
                        height={120}
                        alt="AI character"
                        className="mb-4"
                    />
                    <h2 className="text-2xl font-bold text-gray-900">ログイン</h2>
                    <p className="mt-2 text-sm text-gray-600">
                        リフレクションを始めるにはログインしてください
                    </p>
                </div>

                <button
                    onClick={handleLogin}
                    className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-md text-white bg-pink-100 hover:bg-pink-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500"
                >
                    Googleでログイン
                </button>
            </div>
        </div>
    );
} 