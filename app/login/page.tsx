// Googleログインページ
// NextAuthを利用したGoogleログインボタンを表示

'use client'

import { signIn } from 'next-auth/react';
import Image from 'next/image';
import { DynaPuff } from 'next/font/google';

const dynaPuff = DynaPuff({
    subsets: ['latin'],
    display: 'swap',
});


export default function LoginPage() {
    const handleLogin = () => {
        signIn('google', { callbackUrl: '/' });
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
            <div className="w-full max-w-md p-20 space-y-8 bg-white rounded-lg shadow-md">
                <div className={`text-green-500 text-4xl ${dynaPuff.className} text-center mb-24`}>
                    Refle
                </div>
                <button
                    onClick={handleLogin}
                    className="w-full flex items-center justify-center px-5 py-2 border border-transparent font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                >
                    Googleログイン
                </button>
                <button
                    onClick={handleLogin}
                    className="w-full flex items-center justify-center px-4 py-2 border border-transparent font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                >
                    新規登録
                </button>
            </div>
        </div>
    );
} 