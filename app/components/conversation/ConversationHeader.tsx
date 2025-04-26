/**
 * app/components/conversation/ConversationHeader.tsx
 * 会話インターフェースのヘッダー部分
 */
import React from 'react';

interface ConversationHeaderProps {
    isConnected: boolean;
    onEndSession: () => void;
}

export default function ConversationHeader({ isConnected, onEndSession }: ConversationHeaderProps) {
    return (
        <header className="flex justify-between items-center p-4 bg-pink-50 shadow-sm">
            <h1 className="text-xl font-bold">リアルタイム音声会話</h1>
            <div className="flex items-center gap-3">
                {/* 接続状態インジケーター */}
                <div className={`h-3 w-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span>{isConnected ? 'オンライン' : '接続中...'}</span>
                {/* 終了ボタン */}
                <button
                    onClick={onEndSession}
                    className="px-4 py-2 bg-pink-100 rounded-lg hover:bg-pink-200"
                >
                    終了
                </button>
            </div>
        </header>
    );
} 