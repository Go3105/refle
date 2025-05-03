// Googleログインページ
// NextAuthを利用したGoogleログインボタンを表示

'use client'

import { signIn } from 'next-auth/react';
import { DynaPuff } from 'next/font/google';
import { FcGoogle } from "react-icons/fc";
import { IoPersonCircleOutline } from "react-icons/io5";

const dynaPuff = DynaPuff({
    subsets: ['latin'],
    display: 'swap',
});


export default function LoginPage() {
    const handleLogin = () => {
        signIn('google', { callbackUrl: '/' });
    };
    const handleRegister = () => {
        signIn('google', { callbackUrl: '/register' });
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
            <div className="w-full max-w-md p-20 space-y-8 bg-white rounded-lg shadow-md">
                <div className={`text-green-500 text-4xl ${dynaPuff.className} text-center mb-24`}>
                    Refle
                </div>
                <button
                    onClick={handleLogin}
                    className="w-full relative flex items-center justify-center px-5 py-2 border border-gray-500 font-medium rounded-md text-black bg-white hover:bg-gray-200"
                >
                    <span className="absolute left-4">
                        <FcGoogle className="w-5 h-5" />
                    </span>
                    Googleログイン
                </button>
                <button
                    onClick={handleRegister}
                    className="w-full relative flex items-center justify-center px-5 py-2 border border-transparent font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                >
                    <span className="absolute left-4">
                        <IoPersonCircleOutline className="w-6 h-6" />
                    </span>
                    新規登録
                </button>
            </div>
        </div>
    );
} 