/**
 * app/components/conversation/MessageList.tsx
 * 会話メッセージの一覧表示コンポーネント
 */
import React, { useRef, useEffect } from 'react';
import Image from 'next/image';
import { Message } from './index';

interface MessageListProps {
    messages: Message[];
    currentTranscript?: string;
    isProcessing?: boolean;
    messagesEndRef?: React.RefObject<HTMLDivElement>;
}

export default function MessageList({ 
    messages, 
    currentTranscript = '', 
    isProcessing = false,
    messagesEndRef
}: MessageListProps) {
    // 現在の時刻から経過時刻を計算する関数
    const formatTimestamp = (timestamp?: number): string => {
        if (!timestamp) return '';
        
        const now = Date.now();
        const diff = now - timestamp;
        
        // 1分未満なら「n秒前」と表示
        if (diff < 60000) {
            const seconds = Math.floor(diff / 1000);
            return `${seconds}秒前`;
        }
        
        // 1時間未満なら「n分前」と表示
        if (diff < 3600000) {
            const minutes = Math.floor(diff / 60000);
            return `${minutes}分前`;
        }
        
        // それ以外は時刻を表示
        const date = new Date(timestamp);
        return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
    };
    
    return (
        <div className="space-y-4">
            {/* メッセージ一覧 */}
            {messages.map((message, index) => (
                <div
                    key={index}
                    className={`relative mb-4 ${message.role === 'user'
                        ? 'ml-auto bg-pink-100'
                        : 'mr-auto bg-white flex items-start'
                        } p-3 rounded-lg max-w-[80%]`}
                >
                    {/* AIメッセージにはアイコンを表示 */}
                    {message.role === 'assistant' && (
                        <div className="mr-2 flex-shrink-0">
                            <Image
                                src="/ai_character.png"
                                width={40}
                                height={40}
                                alt="AI character"
                                className="rounded-full"
                            />
                        </div>
                    )}
                    <div className="w-full">
                        <p>{message.content}</p>
                        
                        {/* タイムスタンプ表示 */}
                        {message.timestamp && (
                            <span className="text-xs text-gray-500 block text-right mt-1">
                                {formatTimestamp(message.timestamp)}
                            </span>
                        )}
                    </div>
                </div>
            ))}
            
            {/* 現在認識中のテキスト（中間結果）を表示 */}
            {currentTranscript && (
                <div className="ml-auto bg-pink-50 p-3 rounded-lg max-w-[80%] opacity-70">
                    <p>{currentTranscript}</p>
                    <div className="flex justify-end items-center mt-1">
                        <span className="text-xs text-gray-500 mr-2">認識中...</span>
                        <div className="animate-pulse flex space-x-1">
                            <div className="w-1 h-1 bg-gray-500 rounded-full"></div>
                            <div className="w-1 h-1 bg-gray-500 rounded-full"></div>
                            <div className="w-1 h-1 bg-gray-500 rounded-full"></div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* AIが処理中の表示 */}
            {isProcessing && !currentTranscript && (
                <div className="mr-auto bg-white flex items-center p-3 rounded-lg">
                    <div className="mr-2 flex-shrink-0">
                        <Image
                            src="/ai_character.png"
                            width={40}
                            height={40}
                            alt="AI character"
                            className="rounded-full"
                        />
                    </div>
                    <div className="animate-pulse flex space-x-2">
                        <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                    </div>
                </div>
            )}
            
            {/* スクロール用の参照ポイント */}
            <div ref={messagesEndRef} />
        </div>
    );
} 