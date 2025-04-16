// Googleログインページ
// NextAuthを利用したGoogleログインボタンを表示

'use client'

import { signIn } from 'next-auth/react';

export default function LoginPage() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '100px' }}>
            <h1>Googleアカウントでログイン</h1>
            {/* Googleログインボタン */}
            <button
                onClick={() => signIn('google', { callbackUrl: '/' })}
                style={{
                    padding: '10px 20px',
                    fontSize: '16px',
                    borderRadius: '5px',
                    background: '#4285F4',
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer',
                    marginTop: '20px'
                }}
            >
                Googleでログイン
            </button>
        </div>
    );
} 