'use client';

import { useState, useRef, useEffect } from 'react';
import Head from 'next/head';

type Message = {
    role: 'user' | 'assistant';
    content: string;
};

export default function ChatPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // メッセージが追加されたときに自動スクロール
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage: Message = { role: 'user', content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const res = await fetch('/api/gemini', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: input }),
            });
            const data = await res.json();

            if (data.error) {
                throw new Error(data.error);
            }

            const assistantMessage: Message = {
                role: 'assistant',
                content: data.response
            };
            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            console.error('Error:', error);
            const errorMessage: Message = {
                role: 'assistant',
                content: 'エラーが発生しました。もう一度お試しください。'
            };
            setMessages(prev => [...prev, errorMessage]);
        }
        setIsLoading(false);
    };

    const handleReset = async () => {
        try {
            await fetch('/api/gemini', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ reset: true }),
            });
            setMessages([]);
        } catch (error) {
            console.error('Error resetting conversation:', error);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-gray-50">
            <Head>
                <title>Gemini AI チャット</title>
            </Head>

            <div className="flex-1 overflow-hidden">
                <div className="h-full flex flex-col">
                    <div className="p-4 border-b bg-white flex justify-between items-center">
                        <h1 className="text-xl font-bold text-gray-900">Gemini AI チャット</h1>
                        <button
                            onClick={handleReset}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                        >
                            会話をリセット
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {messages.map((message, index) => (
                            <div
                                key={index}
                                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'
                                    }`}
                            >
                                <div className={`flex items-start max-w-3xl gap-3 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                                    }`}>
                                    <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200">
                                        {message.role === 'assistant' ? (
                                            <div className="w-full h-full bg-green-500 flex items-center justify-center">
                                                <span className="text-white font-bold">G</span>
                                            </div>
                                        ) : (
                                            <div className="w-full h-full bg-blue-500 flex items-center justify-center">
                                                <span className="text-white font-bold">U</span>
                                            </div>
                                        )}
                                    </div>
                                    <div
                                        className={`p-3 rounded-lg ${message.role === 'user'
                                                ? 'bg-blue-500 text-white'
                                                : 'bg-white text-gray-800 shadow-sm'
                                            }`}
                                    >
                                        {message.content}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="flex items-start max-w-3xl gap-3">
                                    <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200">
                                        <div className="w-full h-full bg-green-500 flex items-center justify-center">
                                            <span className="text-white font-bold">G</span>
                                        </div>
                                    </div>
                                    <div className="p-3 rounded-lg bg-white text-gray-800 shadow-sm">
                                        考え中...
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="p-4 border-t bg-white">
                        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="メッセージを入力..."
                                    className="flex-1 p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    disabled={isLoading}
                                />
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                                >
                                    送信
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
} 