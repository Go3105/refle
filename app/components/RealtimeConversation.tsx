'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';

// Socket.IOの型定義のみをインポート
import type { Socket } from 'socket.io-client';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export default function RealtimeConversation() {
    const [isConnected, setIsConnected] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [currentTranscript, setCurrentTranscript] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const socketRef = useRef<Socket | null>(null);
    const recognitionRef = useRef<any>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Socket.IOの接続
    useEffect(() => {
        let isMounted = true;

        const initSocket = async () => {
            try {
                // サーバーサイドのSocket.IOを初期化
                console.log('Socket.IO初期化APIを呼び出しています...');
                const response = await fetch('/api/socketio');
                console.log('Socket.IO初期化API応答:', response.status);

                if (!isMounted) return;

                // Socket.IOクライアントをダイナミックインポート
                console.log('Socket.IOクライアントを初期化しています...');
                const { io } = await import('socket.io-client');

                // Socket.IOクライアントを作成
                const socket = io('', {
                    path: '/api/socketio',
                    reconnectionAttempts: 10,
                    reconnectionDelay: 1000,
                    timeout: 60000,
                    transports: ['websocket', 'polling'],
                    autoConnect: true
                });

                // 接続エラーイベントの処理を追加
                socket.on('connect_error', (err) => {
                    console.error('Socket.IO接続エラー:', err);
                    if (isMounted) setIsConnected(false);
                });

                socketRef.current = socket;

                // 接続イベント
                socket.on('connect', () => {
                    console.log('Socket.IO接続成功:', socket.id);
                    setIsConnected(true);

                    // 初期メッセージを表示
                    setMessages([{
                        role: 'assistant',
                        content: 'こんにちは！今日の振り返りを始めましょう。今日はどんな一日でしたか？'
                    }]);
                });

                // AIの応答受信イベント
                socket.on('ai-response', (data) => {
                    console.log('AI応答受信:', data);
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: data.text
                    }]);
                    setIsProcessing(false);
                });

                // 音声合成リクエスト
                socket.on('speech-request', async (data) => {
                    console.log('音声合成リクエスト:', data);
                    try {
                        const response = await fetch('/api/text-to-speech', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                text: data.text,
                                voiceId: 'JBFqnCBsd6RMkjVDRZzb'
                            })
                        });

                        if (!isMounted) return;

                        if (!response.ok) {
                            throw new Error('音声合成APIエラー');
                        }

                        const audioBlob = await response.blob();
                        const audioUrl = URL.createObjectURL(audioBlob);

                        // 既存の音声を停止
                        if (audioRef.current) {
                            audioRef.current.pause();
                            audioRef.current.currentTime = 0;
                        }

                        // 新しい音声を再生
                        const audio = new Audio(audioUrl);
                        audio.onended = () => {
                            URL.revokeObjectURL(audioUrl);
                        };
                        audioRef.current = audio;
                        audio.play();
                    } catch (error) {
                        console.error('音声合成エラー:', error);
                    }
                });

                // エラーイベント
                socket.on('error', (error) => {
                    console.error('Socket.IOエラー:', error);
                    setIsProcessing(false);
                });

                // 切断イベント
                socket.on('disconnect', () => {
                    console.log('Socket.IO切断');
                    if (isMounted) setIsConnected(false);
                });
            } catch (error) {
                console.error('Socket.IO初期化エラー:', error);
                if (isMounted) setIsConnected(false);
            }
        };

        initSocket();

        // クリーンアップ関数
        return () => {
            isMounted = false;
            if (socketRef.current) {
                console.log('Socket.IO切断（クリーンアップ）');
                socketRef.current.disconnect();
            }
        };
    }, []);

    // 音声認識の初期化
    useEffect(() => {
        if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = true;
            recognitionRef.current.lang = 'ja-JP';

            recognitionRef.current.onresult = (event: any) => {
                const transcript = Array.from(event.results)
                    .map((result: any) => result[0])
                    .map((result: any) => result.transcript)
                    .join('');

                setCurrentTranscript(transcript);
            };

            recognitionRef.current.onend = () => {
                if (isListening) {
                    recognitionRef.current?.start();
                }
            };

            // 一定の無音時間後に文章を送信する処理
            let silenceTimer: NodeJS.Timeout | null = null;

            recognitionRef.current.onaudioend = () => {
                silenceTimer = setTimeout(() => {
                    if (currentTranscript.trim() && !isProcessing) {
                        // ユーザーのメッセージを追加
                        handleSendMessage(currentTranscript);
                    }
                }, 1500); // 1.5秒の無音で送信
            };

            recognitionRef.current.onspeechstart = () => {
                if (silenceTimer) {
                    clearTimeout(silenceTimer);
                    silenceTimer = null;
                }
            };
        }

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, [isListening, currentTranscript, isProcessing]);

    // メッセージが追加されたらスクロールを一番下に移動
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // 音声認識の開始/停止
    const toggleListening = () => {
        if (isListening) {
            stopListening();
        } else {
            startListening();
        }
    };

    const startListening = () => {
        if (!recognitionRef.current || isProcessing) return;
        setCurrentTranscript('');
        setIsListening(true);
        recognitionRef.current.start();
    };

    const stopListening = () => {
        if (!recognitionRef.current) return;
        setIsListening(false);
        recognitionRef.current.stop();

        // 最後の文章を送信
        if (currentTranscript.trim() && !isProcessing) {
            handleSendMessage(currentTranscript);
        }
    };

    // メッセージ送信
    const handleSendMessage = (text: string) => {
        // ユーザーメッセージを表示
        setMessages(prev => [...prev, { role: 'user', content: text }]);

        // 処理中フラグを設定
        setIsProcessing(true);

        // リセット
        setCurrentTranscript('');

        // Socket.IOを通じてサーバーに送信
        if (socketRef.current) {
            console.log('ユーザーメッセージ送信:', text);
            socketRef.current.emit('user-speech', text);
        }
    };

    const handleEndSession = () => {
        // 音声認識を停止
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }

        // 音声再生を停止
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }

        // Socket.IO接続を切断
        if (socketRef.current) {
            socketRef.current.disconnect();
        }

        // リセット
        setIsListening(false);
        setMessages([]);
        setCurrentTranscript('');
        setIsProcessing(false);
        setIsConnected(false);
    };

    return (
        <div className="flex flex-col h-full">
            {/* ヘッダー */}
            <header className="flex justify-between items-center p-4 bg-pink-50 shadow-sm">
                <h1 className="text-xl font-bold">リアルタイム音声会話</h1>
                <div className="flex items-center gap-3">
                    <div className={`h-3 w-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span>{isConnected ? 'オンライン' : '接続中...'}</span>
                    <button
                        onClick={handleEndSession}
                        className="px-4 py-2 bg-pink-100 rounded-lg hover:bg-pink-200"
                    >
                        終了
                    </button>
                </div>
            </header>

            {/* メッセージエリア */}
            <div className="flex-1 overflow-auto p-4 bg-gray-50">
                <div className="max-w-3xl mx-auto">
                    {messages.map((message, index) => (
                        <div
                            key={index}
                            className={`mb-4 ${message.role === 'user'
                                ? 'ml-auto bg-pink-100'
                                : 'mr-auto bg-white flex items-start'
                                } p-3 rounded-lg max-w-[80%]`}
                        >
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
                            <div>
                                <p>{message.content}</p>
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* 入力エリア */}
            <div className="p-4 bg-white border-t">
                <div className="max-w-3xl mx-auto flex items-center gap-2">
                    <div className="flex-1 p-3 min-h-16 border rounded-lg bg-gray-50">
                        {isProcessing ?
                            '処理中...' :
                            (currentTranscript || (isListening ? '聞いています...' : '音声入力ボタンを押して話してください'))}
                    </div>
                    <button
                        onClick={toggleListening}
                        disabled={isProcessing}
                        className={`p-3 rounded-full ${isProcessing ? 'bg-gray-400 text-white cursor-not-allowed' :
                            isListening ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'
                            }`}
                    >
                        {isListening ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="6" y="6" width="12" height="12" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                <line x1="12" y1="19" x2="12" y2="22" />
                            </svg>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
} 