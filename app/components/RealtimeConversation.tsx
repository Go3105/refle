/**
 * app/components/RealtimeConversation.tsx
 * ===========================================
 * リアルタイム音声会話インターフェースを提供するReactコンポーネント
 * 
 * このコンポーネントは以下の機能を提供します：
 * 1. Socket.IOを使用したリアルタイム通信
 * 2. React Speech Recognitionによる音声認識
 * 3. AIからの応答の表示と音声合成によるフィードバック
 * 4. 会話UIと音声制御ボタン
 */
'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { EchoCancellation } from '@/lib/echoCancellation';
import { useBetterSpeechRecognition } from '@/hooks/useBetterSpeechRecognition';
import { useSocketConnection } from '@/hooks/useSocketConnection';
import { Message, ConversationHeader } from '@/components/conversation';
import MessageList from '@/components/conversation/MessageList';
import InputArea from '@/components/conversation/InputArea';
import SummaryDisplay from '@/components/conversation/SummaryDisplay';

/**
 * メッセージデータの型定義
 * 会話の各メッセージを表現する型
 */
export interface Message {
    role: 'user' | 'assistant';  // メッセージの送信者
    content: string;             // メッセージの内容
    timestamp?: number;          // 送信タイムスタンプ
}

export default function RealtimeConversation() {
    // ステート変数
    const [messages, setMessages] = useState<Message[]>([]);     // 会話メッセージ履歴
    const [currentTranscript, setCurrentTranscript] = useState(''); // 現在の音声認識テキスト
    const [isProcessing, setIsProcessing] = useState(false);     // AI処理中フラグ
    const [summary, setSummary] = useState<string>('');          // 会話サマリ
    const [editableSummary, setEditableSummary] = useState<string>(''); // 編集可能なサマリ
    const [showingSummary, setShowingSummary] = useState(false); // サマリ表示状態

    // Refオブジェクト
    const messagesEndRef = useRef<HTMLDivElement>(null);        // メッセージ末尾への参照（自動スクロール用）
    const audioRef = useRef<HTMLAudioElement | null>(null);     // 音声再生用Audio要素
    const echoCancellationRef = useRef<EchoCancellation | null>(null);
    const isMountedRef = useRef(true);
    const lastMessageRef = useRef<string>('');                  // 最後のメッセージ内容
    const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null); // 処理タイムアウト用

    // 改良版音声認識フックの使用
    const { 
        listening, 
        startListening, 
        stopListening, 
        toggleListening,
        transcript,
        isBrowserSupported,
        isProcessing: speechIsProcessing,
    } = useBetterSpeechRecognition({
        onResult: (transcript) => {
            console.log(`音声認識結果: "${transcript}"`);
            
            if (transcript.trim().length > 1 && !isProcessing) {
                // 空白を整理してからチェック
                const cleanText = transcript.trim();
                console.log(`処理する音声認識結果: "${cleanText}"`);
                
                // 音声認識を即座に停止（重要：継続認識をやめる）
                stopListening();
                
                // 発話をシステムに送信
                handleSendMessage(cleanText);
                
                // 認識履歴をリセット（次の発話のために）
                lastMessageRef.current = cleanText;
            }
        },
        onInterim: (transcript) => {
            // 中間結果は単に表示するだけ
            setCurrentTranscript(transcript);
        },
        langCode: 'ja-JP',
        // 継続認識の設定
        continuous: false,     // 継続モードはオフ
        autoRestart: false,    // 自動再起動はオフ
        restartDelay: 1000
    });

    // Socket.IOフックの使用
    const { 
        isConnected, 
        socketRef,
        disconnect
    } = useSocketConnection({
        onConnect: () => {
            // 接続成功時に音声認識を開始
            if (isBrowserSupported) {
                console.log('接続成功: 初回音声認識を開始します');
                // 履歴をクリアして開始
                lastMessageRef.current = '';
                
                // 前のセッションが残っていることを防ぐために少し遅延
                setTimeout(() => {
                    startListening(); 
                }, 500);
            } else {
                console.error('このブラウザは音声認識をサポートしていません');
                alert('このブラウザは音声認識をサポートしていません。Chrome、Edge、Safariなどの最新ブラウザをお使いください。');
            }
        },
        onAiResponse: (data) => {
            // AIのレスポンスをメッセージ一覧に追加
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: data.text,
                timestamp: Date.now()
            }]);
            
            // 音声認識と処理フラグをリセット
            setIsProcessing(false);
            setCurrentTranscript('');
            
            // 最後のユーザー発話を忘れる
            lastMessageRef.current = '';
            
            console.log('AI応答後に音声認識を再開します');
            
            // 少し遅延して再開 (レスポンスを処理する時間を確保)
            setTimeout(() => {
                if (isMountedRef.current) {
                    // 完全に新しいセッションとして開始
                    startListening();
                }
            }, 800);
            
            // 処理タイムアウトがあれば解除
            if (processingTimeoutRef.current) {
                clearTimeout(processingTimeoutRef.current);
                processingTimeoutRef.current = null;
            }
        },
        onReadyForNextInput: (data) => {
            if (data.keep_listening === true) {
                setIsProcessing(false);
                setCurrentTranscript('');
                
                // 最後のユーザー発話を忘れる
                lastMessageRef.current = '';
                
                console.log('次の入力準備完了: 音声認識を再開します');
                
                setTimeout(() => {
                    if (isMountedRef.current) {
                        // 完全に新しいセッションとして開始
                        startListening();
                    }
                }, 500);
                
                // 処理タイムアウトがあれば解除
                if (processingTimeoutRef.current) {
                    clearTimeout(processingTimeoutRef.current);
                    processingTimeoutRef.current = null;
                }
            }
        },
        onAudioStream: (data) => {
            playAudioFromBase64(data.audio, data.contentType);
        }
    });

    /**
     * マウント状態の追跡
     */
    useEffect(() => {
        isMountedRef.current = true;
        
        // エコーキャンセリングを初期化
        echoCancellationRef.current = new EchoCancellation();
        
        return () => {
            isMountedRef.current = false;
            
            // エコーキャンセリングを停止
            if (echoCancellationRef.current) {
                echoCancellationRef.current.stop();
            }
            
            // タイムアウトをクリア
            if (processingTimeoutRef.current) {
                clearTimeout(processingTimeoutRef.current);
                processingTimeoutRef.current = null;
            }
        };
    }, []);

    /**
     * メッセージスクロール処理
     */
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    /**
     * 処理状態の変更を追跡
     */
    useEffect(() => {
        setIsProcessing(speechIsProcessing);
    }, [speechIsProcessing]);

    /**
     * Base64エンコードされた音声データを再生する
     */
    const playAudioFromBase64 = (base64Data: string, contentType: string) => {
        try {
            // Base64エンコードされた音声データをデコード
            const audioData = atob(base64Data);
            
            // バイナリデータに変換
            const byteNumbers = new Array(audioData.length);
            for (let i = 0; i < audioData.length; i++) {
                byteNumbers[i] = audioData.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            
            // Blobを作成
            const audioBlob = new Blob([byteArray], { type: contentType });
            const audioUrl = URL.createObjectURL(audioBlob);
            
            // 既存の音声を停止
            if (audioRef.current) {
                try {
                    audioRef.current.pause();
                    audioRef.current.currentTime = 0;
                } catch (error) {
                    console.error('既存の音声停止エラー:', error);
                }
            }
            
            // 新しい音声オブジェクトを作成
            const audio = new Audio();
            
            // イベントハンドラを設定
            audio.oncanplaythrough = () => {
                console.log('音声再生準備完了');
            };
            
            audio.onended = () => {
                console.log('音声再生が終了しました');
                URL.revokeObjectURL(audioUrl);
            };
            
            audio.onerror = (error) => {
                console.error('音声再生エラー:', error);
                URL.revokeObjectURL(audioUrl);
                
                // エラー時はサーバーに通知
                if (socketRef.current) {
                    socketRef.current.emit('tts-error', { error: 'オーディオ再生エラー' });
                }
            };
            
            // ソースを設定
            audio.src = audioUrl;
            audioRef.current = audio;
            
            // 自動再生の問題に対処
            try {
                // ミュートして再生を試みる
                audio.volume = 0;
                audio.play().then(() => {
                    // 再生が始まったらボリュームを上げる
                    setTimeout(() => {
                        if (audio) {
                            // 徐々にボリュームを上げる
                            audio.volume = 0.2;
                            setTimeout(() => { audio.volume = 0.5; }, 50);
                            setTimeout(() => { audio.volume = 0.8; }, 100);
                            setTimeout(() => { audio.volume = 1.0; }, 150);
                        }
                    }, 50);
                }).catch(playError => {
                    console.error('音声自動再生エラー:', playError);
                });
            } catch (playError) {
                console.error('音声自動再生エラー:', playError);
            }
        } catch (error) {
            console.error('音声データ処理エラー:', error);
            
            // エラー時はサーバーに通知
            if (socketRef.current) {
                socketRef.current.emit('tts-error', { error: error.message });
            }
        }
    };

    /**
     * メッセージを送信する関数
     */
    const handleSendMessage = (text: string) => {
        // 空のテキストは無視
        if (!text.trim()) return;
        
        // 前のメッセージと同じなら無視（重複防止）
        if (text.trim() === lastMessageRef.current.trim()) {
            console.log('重複メッセージのため送信をスキップします:', text);
            return;
        }
        
        // 音声認識を確実に停止
        stopListening();
        
        // ユーザーメッセージを表示
        setMessages(prev => [...prev, { 
            role: 'user', 
            content: text,
            timestamp: Date.now()
        }]);

        // 処理中フラグを設定
        setIsProcessing(true);

        // リセット
        setCurrentTranscript('');
        
        // メッセージ送信後は直ちに音声認識を完全クリア
        lastMessageRef.current = text.trim();

        // Socket.IOを通じてサーバーに送信
        if (socketRef.current) {
            console.log('ユーザーメッセージ送信:', text);
            socketRef.current.emit('user-speech', text);
            
            // 応答がない場合のタイムアウト (20秒)
            processingTimeoutRef.current = setTimeout(() => {
                console.log('サーバー応答タイムアウト - 音声認識を再開します');
                setIsProcessing(false);
                startListening();
            }, 20000);
        }
    };

    // 音声ボタンのToggle処理を修正
    const handleToggleMic = () => {
        if (listening) {
            console.log('マイクをオフにします');
            stopListening();
        } else {
            console.log('マイクをオンにします');
            // クリーンな状態から開始
            lastMessageRef.current = '';
            startListening();
        }
    };

    /**
     * セッションを終了する関数
     */
    const handleEndSession = () => {
        // 音声再生を停止
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }

        // エコーキャンセリングを停止
        if (echoCancellationRef.current) {
            echoCancellationRef.current.stop();
        }

        // サマリを生成して表示
        createSummary();
        
        // リセット
        stopListening();
        setCurrentTranscript('');
        setIsProcessing(false);
        
        // タイムアウトをクリア
        if (processingTimeoutRef.current) {
            clearTimeout(processingTimeoutRef.current);
            processingTimeoutRef.current = null;
        }
        
        // Socket.IO接続を切断（サマリ生成後に切断）
        setTimeout(() => {
            disconnect();
        }, 1000);
    };

    /**
     * 会話サマリを生成する関数
     */
    const createSummary = async () => {
        // サマリ表示状態を設定
        setShowingSummary(true);
        
        try {
            const response = await fetch('/api/summary', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ messages }),
            });
            
            if (!response.ok) {
                throw new Error('サマリの生成に失敗しました');
            }
            
            const data = await response.json();
            setSummary(data.summary);
            setEditableSummary(data.summary);
        } catch (error) {
            console.error('サマリ生成エラー:', error);
            setSummary('サマリの生成に失敗しました。もう一度お試しください。');
            setEditableSummary('サマリの生成に失敗しました。もう一度お試しください。');
        }
    };

    /**
     * サマリテキストの変更ハンドラ
     */
    const handleSummaryChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setEditableSummary(e.target.value);
    };

    /**
     * サマリの保存ハンドラ
     */
    const handleSummarySave = () => {
        // サマリの保存処理（APIリクエストなど）
        console.log('サマリを保存します:', editableSummary);
        
        // サマリ編集モードを閉じる
        setShowingSummary(false);
    };

    // ブラウザサポートがない場合の代替表示
    if (!isBrowserSupported) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-4">
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div className="ml-3">
                            <p className="text-sm text-yellow-700">
                                このブラウザは音声認識をサポートしていません。
                            </p>
                            <p className="mt-2 text-sm text-yellow-700">
                                Chrome、Edge、Safariなどの最新ブラウザをお使いください。
                            </p>
                        </div>
                    </div>
                </div>
                <button 
                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                    onClick={() => window.location.reload()}
                >
                    再読み込み
                </button>
            </div>
        );
    }

    /**
     * コンポーネントのレンダリング
     */
    return (
        <div className="flex flex-col h-full">
            <ConversationHeader 
                isConnected={isConnected} 
                onEndSession={handleEndSession} 
            />

            <div className="flex-1 overflow-auto p-4 bg-gray-50">
                <div className="max-w-3xl mx-auto">
                    {showingSummary ? (
                        <SummaryDisplay
                            summary={editableSummary}
                            onSummaryChange={handleSummaryChange}
                            onSave={handleSummarySave}
                        />
                    ) : (
                        <MessageList 
                            messages={messages} 
                            currentTranscript={currentTranscript}
                            isProcessing={isProcessing}
                            messagesEndRef={messagesEndRef}
                        />
                    )}
                    
                    <div ref={messagesEndRef} />
                </div>
            </div>

            <InputArea
                isListening={listening}
                onToggleListening={handleToggleMic}
                currentTranscript={currentTranscript}
                isProcessing={isProcessing}
                onSendMessage={handleSendMessage}
                isDisabled={showingSummary}
            />
        </div>
    );
} 