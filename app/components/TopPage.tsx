'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import AccountMenu from './AccountMenu';
import { SignOutButton } from './SignOutButton';
import Microphoneicon from './Microphoneicon';
import { DynaPuff } from 'next/font/google';
import UnifiedChatInterface from './UnifiedChatInterface';
import { useConversation } from '../context/ConversationContext';

const dynaPuff = DynaPuff({
    subsets: ['latin'],
    display: 'swap',
});

export default function TopPage({ username }: { username: string }) {
    const [showConversation, setShowConversation] = useState(false);
    const [micHover, setMicHover] = useState(false);
    const { startConversation, resetConversation } = useConversation();
    const buttonRef = useRef<HTMLDivElement>(null);
    const mainContainerRef = useRef<HTMLDivElement>(null);
    const signOutRef = useRef<HTMLDivElement>(null);
    const accountRef = useRef<HTMLDivElement>(null);
    const logoRef = useRef<HTMLDivElement>(null);

    // ボタンホバー状態管理
    const updateMicHoverState = (clientX: number, clientY: number) => {
        if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            const isInButtonArea = 
                clientX >= rect.left && 
                clientX <= rect.right && 
                clientY >= rect.top && 
                clientY <= rect.bottom;
            
            setMicHover(isInButtonArea);
        }
    };

    // クリック処理ハンドラ
    const handleMainContainerClick = (e: React.MouseEvent) => {
        // ボタンの領域内かどうかチェック
        if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            const isInButtonArea = 
                e.clientX >= rect.left && 
                e.clientX <= rect.right && 
                e.clientY >= rect.top && 
                e.clientY <= rect.bottom;
            
            // ボタンの領域内の場合、ボタンのクリックイベントを発火
            if (isInButtonArea) {
                handleStartReflection();
                return;
            }
        }
        
        // サインアウトボタンのチェック
        if (signOutRef.current) {
            const rect = signOutRef.current.getBoundingClientRect();
            if (
                e.clientX >= rect.left && 
                e.clientX <= rect.right && 
                e.clientY >= rect.top && 
                e.clientY <= rect.bottom
            ) {
                // サインアウトボタン内の要素（実際のボタン）を探してクリック
                const button = signOutRef.current.querySelector('button');
                if (button) {
                    button.click();
                }
                return;
            }
        }
        
        // アカウントメニューのチェック
        if (accountRef.current) {
            const rect = accountRef.current.getBoundingClientRect();
            if (
                e.clientX >= rect.left && 
                e.clientX <= rect.right && 
                e.clientY >= rect.top && 
                e.clientY <= rect.bottom
            ) {
                // アカウントメニュー内の要素を探してクリック
                const button = accountRef.current.querySelector('button');
                if (button) {
                    button.click();
                }
                return;
            }
        }
    };

    const handleStartReflection = () => {
        startConversation();
        setShowConversation(true);
    };

    return (
        <div 
            ref={mainContainerRef}
            className="h-screen w-screen flex flex-col relative"
            onClick={handleMainContainerClick}
            onMouseMove={(e) => {
                updateMicHoverState(e.clientX, e.clientY);
            }}
        >
            {!showConversation ? (
                <>
                    {/* ヘッダー部分（緑色のバー） */}
                    <div className="w-full h-20 bg-green-400 absolute top-0 left-0 z-10">
                        <div 
                            ref={logoRef}
                            className={`absolute top-5 left-20 text-white text-4xl ${dynaPuff.className}`}
                        >
                            Refle
                        </div>
                        <div 
                            ref={signOutRef}
                            className="absolute top-4 right-20 flex items-center"
                        >
                            <SignOutButton />
                        </div>
                        <div 
                            ref={accountRef}
                            className="absolute top-4 right-6 flex items-center"
                        >
                            <AccountMenu />
                        </div>
                    </div>
                    
                    {/* メインコンテンツエリア */}
                    <div className="flex flex-col items-center justify-center flex-grow">
                        <div className="relative w-[22rem] h-[22rem] mt-20">
                            {/* アニメーション全体を表示する非インタラクティブな背景 */}
                            <div className="absolute inset-0 pointer-events-none">
                                <Microphoneicon isHovered={micHover} />
                            </div>
                            
                            {/* 中心のマイク部分だけクリック可能にする透明ボタン（実際にはクリックイベントは親要素で処理） */}
                            <div
                                ref={buttonRef}
                                className="absolute rounded-full w-[8.4rem] h-[8.4rem] bg-transparent"
                                style={{
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)'
                                }}
                            />
                        </div>
                    </div>
                </>
            ) : (
                <UnifiedChatInterface />
            )}
        </div>
    );
}