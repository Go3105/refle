/**
 * app/components/conversation/ConversationHeader.tsx
 * 会話インターフェースのヘッダー部分
 */
import React from 'react';
import { UserCircle } from 'lucide-react';

interface ConversationHeaderProps {
    isConnected?: boolean;
    onEndSession: () => void;
    isProcessing?: boolean;
    isDisabled?: boolean;
}

export default function ConversationHeader({ isConnected = true, onEndSession, isProcessing, isDisabled }: ConversationHeaderProps) {
    return (
        <header className="bg-gradient-to-r from-green-400 to-green-500 p-4 flex justify-between items-center shadow-md">
            <div className="text-white font-bold text-2xl">Refle</div>
            <div className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full ${isConnected ? 'bg-green-100' : 'bg-red-500'} mr-1`} />
                <span className="text-white text-sm mr-2">{isConnected ? 'オンライン' : '接続中...'}</span>
                <button
                    onClick={onEndSession}
                    className="bg-white text-green-500 px-4 py-2 rounded-md font-medium transition-all hover:bg-gray-100"
                    disabled={isDisabled || isProcessing}
                >
                    サインアウト
                </button>
                <div className="bg-white rounded-full p-1 cursor-pointer">
                    <UserCircle className="h-7 w-7 text-gray-600" />
                </div>
            </div>
        </header>
    );
} 