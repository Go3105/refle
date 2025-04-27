/**
 * app/components/RealtimeConversation.tsx
 * ===========================================
 * リアルタイム音声会話インターフェースを提供するReactコンポーネント
 * 
 * このコンポーネントは以下の機能を提供します：
 * 1. Socket.IOを使用したリアルタイム通信
 * 2. Web Speech APIによる音声認識
 * 3. AIからの応答の表示と音声合成によるフィードバック
 * 4. 自然な会話ターン制御
 */
'use client';

import React, { useEffect, useRef, useState, RefObject } from 'react';
import { Socket } from 'socket.io-client';
import styles from './RealtimeConversation.module.css';

// 会話関連コンポーネントのインポート
import { ConversationHeader, MessageList, InputArea, SummaryDisplay } from '../components/conversation';
import useSpeech from '../lib/hooks/useSpeech';
import { useSocketConnection } from '../hooks/useSocketConnection';

/**
 * メッセージデータの型定義
 * 会話の各メッセージを表現する型
 */
export interface Message {
    role: 'user' | 'assistant';  // メッセージの送信者
    content: string;             // メッセージの内容
    timestamp?: number;          // 送信タイムスタンプ
}

// Socket.IOサーバーのURL
const SOCKET_SERVER_URL = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || 'http://localhost:3001';

export default function RealtimeConversation() {
    // ステート変数
    const [messages, setMessages] = useState<Message[]>([]);     // 会話メッセージ履歴
    const [isProcessing, setIsProcessing] = useState(false);     // AI処理中フラグ
    const [summary, setSummary] = useState<string>('');          // 会話サマリ
    const [editableSummary, setEditableSummary] = useState<string>(''); // 編集可能なサマリ
    const [showingSummary, setShowingSummary] = useState(false); // サマリ表示状態
    const [conversationEnded, setConversationEnded] = useState(false); // 会話終了フラグ
    const [micPermission, setMicPermission] = useState<boolean | null>(null); // マイク許可状態
    const [recognitionRestart, setRecognitionRestart] = useState(false); // 音声認識再開フラグ
    const [isEditing, setIsEditing] = useState<boolean>(false); // サマリ編集状態

    // Refオブジェクト
    const messagesEndRef = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>;        // メッセージ末尾への参照（自動スクロール用）
    const isMountedRef = useRef(true);
    const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null); // 処理タイムアウト用
    const audioElementRef = useRef<HTMLAudioElement>(null);     // 音声再生用Audio要素
    const socketRefInternal = useRef<any>(null);                // Socket.IO参照用の内部Ref
    const recognitionTimerRef = useRef<NodeJS.Timeout | null>(null); // 音声認識再開タイマー

    // イベント結果を追跡（二重処理防止）
    const lastEventTimeRef = useRef<{[key: string]: number}>({
        readyForNextInput: 0,
        audioEnded: 0
    });

    // Socket.IOフックの使用
    const { 
        isConnected, 
        socketRef,
        disconnect
    } = useSocketConnection({
        onConnect: () => {
            // 接続成功時に音声認識を開始
            console.log('接続成功: 初回音声認識を開始します');
            
            // 前のセッションが残っていることを防ぐために少し遅延
            setTimeout(() => {
                if (!conversationEnded) {
                    startListening(); 
                }
            }, 500);
        },
        onAiResponse: (data) => {
            // AIのレスポンスをメッセージ一覧に追加
            console.log('AI応答受信イベント発生:', data.text.substring(0, 30) + '...');
            
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: data.text,
                timestamp: Date.now()
            }]);
            
            // 処理フラグをリセット
            setIsProcessing(false);
            
            console.log('AI応答を受信しました。次の入力待機中...');
            
            // 処理タイムアウトがあれば解除
            if (processingTimeoutRef.current) {
                clearTimeout(processingTimeoutRef.current);
                processingTimeoutRef.current = null;
            }
            
            // AIの応答が完了したら次のターンの準備
            // 音声合成→音声再生が終わった後に音声認識が自動的に開始されるため、
            // ここでは特に何もしない
        },
        onReadyForNextInput: (data: { keep_listening?: boolean; reset_state?: boolean }) => {
            console.log('次の入力準備完了:', data);
            
            // イベント受信時に強制的に処理中フラグをリセット
            setIsProcessing(false);
            
            // 処理タイムアウトがあれば解除
            if (processingTimeoutRef.current) {
                clearTimeout(processingTimeoutRef.current);
                processingTimeoutRef.current = null;
            }
            
            // 会話が終了していれば何もしない
            if (conversationEnded) return;
            
            // デバウンス処理：短時間に複数呼ばれるのを防止
            const now = Date.now();
            if (now - lastEventTimeRef.current.readyForNextInput < 1000) {
                console.log('前回のready-for-next-inputから1秒以内のため、処理をスキップします');
                return;
            }
            lastEventTimeRef.current.readyForNextInput = now;
            
            // サーバーからの状態リセット指示がある場合
            if (data.reset_state) {
                console.log('サーバーからの指示により状態を完全リセットします');
                
                // 音声認識を一度完全に停止
                stopListening();
                
                // 少し待機してから再開
                const resetTimeout = setTimeout(() => {
                    if (isMountedRef.current) {
                        console.log('完全リセット後に音声認識を再開します');
                        setRecognitionRestart(true); // 再開フラグを使用
                    }
                }, 800);
                
                // コンポーネントがアンマウントされた場合のクリーンアップ
                return () => clearTimeout(resetTimeout);
            }
            
            // リスニング継続フラグがある場合
            if (data.keep_listening === true) {
                // 音声認識の再開を確実にするため、少し遅延を入れる
                console.log('次の入力準備完了: 音声認識を1000ms後に再開します');
                
                // 現在のリスニング状態をログ出力
                console.log('現在の音声認識状態:', { isListening, isProcessing, timestamp: Date.now() });
                
                // いったん音声認識を停止してから再開する（より確実に）
                stopListening();
                
                // 十分な遅延を入れて再開（再開フラグを使用）
                const restartTimeout = setTimeout(() => {
                    if (isMountedRef.current) {
                        console.log('音声認識を再開します (強制再開)');
                        // 再開フラグを設定して、専用のエフェクトで処理
                        setRecognitionRestart(true);
                    }
                }, 1000);
                
                // クリーンアップ関数を返す
                return () => clearTimeout(restartTimeout);
            }
        },
        onAudioStream: (data) => {
            playAudioFromBase64(data.audio, data.contentType);
        }
    });

    // socketRefを内部Refに同期
    useEffect(() => {
        if (socketRef.current) {
            console.log('socketRef.currentが変更されました');
            socketRefInternal.current = socketRef.current;
            
            // 接続状態を確認
            socketRef.current.emit('ping');
        }
    }, [socketRef.current]);

    // 1分ごとにping送信（接続維持）
    useEffect(() => {
        const pingInterval = setInterval(() => {
            if (socketRef.current && isConnected && !conversationEnded) {
                socketRef.current.emit('ping');
            }
        }, 60000);
        
        return () => clearInterval(pingInterval);
    }, [socketRef.current, isConnected, conversationEnded]);

    // 音声認識フックの使用
    const {
        isListening,
        currentTranscript,
        toggleListening,
        startListening,
        stopListening,
        isProcessing: speechIsProcessing,
        audioRef
    } = useSpeech({
        onMessageReady: handleSendMessage,
        socketRef: socketRefInternal
    });

    // audioRef設定
    useEffect(() => {
        if (audioElementRef.current) {
            audioRef.current = audioElementRef.current;
        }
    }, [audioRef]);

    /**
     * マウント状態の追跡
     */
    useEffect(() => {
        isMountedRef.current = true;
        
        return () => {
            isMountedRef.current = false;
            
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
        if (speechIsProcessing !== isProcessing) {
            setIsProcessing(speechIsProcessing);
        }
    }, [speechIsProcessing]);

    /**
     * マイク許可状態の確認
     */
    useEffect(() => {
        async function checkMicrophonePermission() {
            try {
                // ブラウザがPermissions APIをサポートしているか確認
                if (navigator.permissions && navigator.permissions.query) {
                    const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
                    console.log('マイクの許可状態:', permissionStatus.state);
                    setMicPermission(permissionStatus.state === 'granted');
                    
                    // 許可状態が変更された時のイベントリスナー
                    permissionStatus.onchange = () => {
                        console.log('マイクの許可状態が変更されました:', permissionStatus.state);
                        setMicPermission(permissionStatus.state === 'granted');
                        
                        // 許可された場合は音声認識を開始
                        if (permissionStatus.state === 'granted') {
                            startListening();
                        }
                    };
                } else {
                    console.log('Permissions APIがサポートされていません。マイク許可状態を確認できません。');
                    
                    // 代替：実際にマイクアクセスを試みる
                    try {
                        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                        stream.getTracks().forEach(track => track.stop());
                        setMicPermission(true);
                    } catch (error) {
                        console.error('マイクアクセスエラー:', error);
                        setMicPermission(false);
                    }
                }
            } catch (error) {
                console.error('マイク許可状態チェックエラー:', error);
            }
        }
        
        checkMicrophonePermission();
    }, [startListening]);

    /**
     * 音声認識の再開を確実に行うエフェクト
     */
    useEffect(() => {
        if (recognitionRestart && !isProcessing && !conversationEnded && isMountedRef.current) {
            console.log('★★★ 音声認識再開フラグに基づいて再開します');
            
            // フラグをリセット
            setRecognitionRestart(false);
            
            // 安全に少し待ってから再開
            const restartTimer = setTimeout(() => {
                if (isMountedRef.current) {
                    startListening();
                }
            }, 500);
            
            return () => clearTimeout(restartTimer);
        }
    }, [recognitionRestart, isProcessing, conversationEnded, startListening]);

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
            if (audioElementRef.current) {
                try {
                    audioElementRef.current.pause();
                    audioElementRef.current.currentTime = 0;
                } catch (error) {
                    console.error('既存の音声停止エラー:', error);
                }
            }
            
            // 音声再生の準備
            if (audioElementRef.current) {
                audioElementRef.current.src = audioUrl;
                
                // 音声の再生完了イベント
                audioElementRef.current.onended = () => {
                    console.log('音声再生が終了しました');
                    URL.revokeObjectURL(audioUrl);
                    
                    // 会話が終了していなければ、音声認識を自動的に開始
                    if (!conversationEnded) {
                        console.log('音声再生完了後に音声認識を再開します');
                        // 処理中フラグをリセット
                        setIsProcessing(false);
                        
                        // ブラウザの状態同期のために少し待機
                        setTimeout(() => {
                            // 短い間隔で連続して呼ばれるのを防止
                            const now = Date.now();
                            if (now - lastEventTimeRef.current.audioEnded > 1000) {
                                lastEventTimeRef.current.audioEnded = now;
                                
                                // 既存のタイマーをクリアして新しいタイマーを設定
                                if (recognitionTimerRef.current) {
                                    clearTimeout(recognitionTimerRef.current);
                                }
                                
                                // 音声認識を再開する（専用フラグで確実に）
                                recognitionTimerRef.current = setTimeout(() => {
                                    if (isMountedRef.current) {
                                        console.log('★★★ 音声再生完了から1000ms後に音声認識を再開します ★★★');
                                        setRecognitionRestart(true);
                                    }
                                }, 1000);
                            }
                        }, 100);
                    }
                };
                
                // 音声再生エラー時の対応を追加
                audioElementRef.current.onerror = (e) => {
                    console.error('音声再生エラー:', e);
                    // エラー時も音声認識を再開
                    if (!conversationEnded && !isProcessing && !isListening) {
                        setRecognitionRestart(true);
                    }
                };
                
                // 音声再生
                audioElementRef.current.play().catch(error => {
                    console.error('音声再生エラー:', error);
                    // エラー時も音声認識を再開
                    if (!conversationEnded && !isProcessing && !isListening) {
                        setRecognitionRestart(true);
                    }
                });
            }
        } catch (error) {
            console.error('音声データ処理エラー:', error);
            // エラー時も音声認識を再開
            if (!conversationEnded && !isProcessing && !isListening) {
                setRecognitionRestart(true);
            }
        }
    };

    /**
     * メッセージを送信する関数
     */
    function handleSendMessage(text: string) {
        // 空のメッセージは送信しない
        if (!text.trim() || isProcessing || conversationEnded) return;
        
        // 新しいメッセージを追加
        const newMessage: Message = {
            role: 'user',
            content: text,
            timestamp: Date.now()
        };
        
        // メッセージリストを更新
        setMessages(prev => [...prev, newMessage]);
        
        // 処理中フラグを設定
        setIsProcessing(true);
        
        console.log('メッセージを送信:', text);
        
        // Socket.IOで送信 - 'chat-message'ではなく'user-speech'イベントを使用
        if (socketRef?.current) {
            socketRef.current.emit('user-speech', text);
            console.log('user-speechイベントを送信しました:', text);
            
            // 処理タイムアウトを設定（30秒後にタイムアウト）
            processingTimeoutRef.current = setTimeout(() => {
                if (isProcessing) {
                    console.log('AIレスポンスのタイムアウト: 処理をリセットします');
                    setIsProcessing(false);
                    
                    // タイムアウトメッセージを表示
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: 'レスポンスの取得に時間がかかりすぎています。もう一度お試しください。',
                        timestamp: Date.now()
                    }]);
                    
                    // 音声認識を再開
                    setTimeout(() => {
                        if (isMountedRef.current && !conversationEnded) {
                            startListening();
                        }
                    }, 500);
                }
            }, 30000);
        } else {
            console.error('Socket接続がありません');
            setIsProcessing(false);
        }
    }

    /**
     * マイクボタンの切り替え処理
     */
    const handleToggleMic = () => {
        if (conversationEnded) return;
        
        if (isProcessing) {
            // 処理中は何もしない
            return;
        }
        
        toggleListening();
    };

    /**
     * 会話を終了する
     */
    const handleEndSession = () => {
        // 音声認識を停止
        stopListening();
        
        // 会話終了フラグを立てる
        setConversationEnded(true);
        
        // Socket接続を切断
        if (socketRef?.current) {
            socketRef.current.emit('end-session');
            disconnect();
        }
        
        // 会話サマリを作成
        createSummary();
    };

    /**
     * 会話サマリを作成する
     */
    const createSummary = async () => {
        if (messages.length === 0) return;
        
        try {
            setIsProcessing(true);
            
            // サマリ生成APIを呼び出す
            const response = await fetch('/api/summarize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ messages })
            });
            
            if (!response.ok) {
                throw new Error('サマリの生成に失敗しました');
            }
            
            const data = await response.json();
            setSummary(data.summary);
            setEditableSummary(data.summary);
            setShowingSummary(true);
        } catch (error) {
            console.error('サマリ生成エラー:', error);
            alert('会話のサマリ生成に失敗しました。');
        } finally {
            setIsProcessing(false);
        }
    };

    /**
     * サマリの編集処理
     */
    const handleSummaryChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setEditableSummary(e.target.value);
    };

    /**
     * サマリの保存処理
     */
    const handleSaveSummary = () => {
        setSummary(editableSummary);
        setShowingSummary(false);
        setIsEditing(false);
        
        // サーバーにサマリを保存する処理をここに追加可能
    };

    // マイク許可を要求する関数
    const requestMicrophonePermission = async () => {
        try {
            console.log('マイクの許可を要求しています...');
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log('マイク許可が付与されました');
            
            // 一度許可を得たらストリームを停止し、音声認識を開始
            stream.getTracks().forEach(track => track.stop());
            setMicPermission(true);
            
            // 少し遅延して音声認識を開始
            setTimeout(() => {
                startListening();
            }, 500);
        } catch (error) {
            console.error('マイク許可要求エラー:', error);
            setMicPermission(false);
            alert('音声対話を利用するには、マイクへのアクセスを許可してください。');
        }
    };

    // マイク権限が付与されていない場合の表示
    if (micPermission === false && !showingSummary) {
        return (
            <div className="flex flex-col h-screen bg-gray-50 items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow-lg p-6 max-w-md text-center">
                    <div className="text-6xl mb-4">🎤</div>
                    <h2 className="text-2xl font-bold mb-4">マイクへのアクセスが必要です</h2>
                    <p className="mb-6 text-gray-600">
                        この音声対話アプリケーションを使用するには、マイクへのアクセス許可が必要です。
                        「許可する」ボタンをクリックして、ブラウザのマイク許可リクエストを承認してください。
                    </p>
                    <button
                        onClick={requestMicrophonePermission}
                        className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                    >
                        マイクの使用を許可する
                    </button>
                </div>
            </div>
        );
    }

    // 会話終了時とサマリ表示時のUI
    if (showingSummary) {
        return (
            <div className="flex flex-col h-screen bg-gray-50">
                {/* 会話ヘッダー */}
                <ConversationHeader 
                    onEndSession={handleEndSession}
                    isProcessing={isProcessing}
                    isDisabled={conversationEnded}
                />
                
                {/* メッセージ一覧 */}
                <MessageList 
                    messages={messages}
                    messagesEndRef={messagesEndRef}
                />
                
                {/* 音声再生用の非表示オーディオ要素 */}
                <audio ref={audioElementRef} className="hidden" />
                
                {/* 入力エリア */}
                <InputArea
                    isListening={isListening}
                    isProcessing={isProcessing}
                    currentTranscript={currentTranscript}
                    toggleListening={handleToggleMic}
                    onSendMessage={handleSendMessage}
                    isDisabled={conversationEnded}
                />

                {summary && (
                    <div className="w-full p-4">
                        <SummaryDisplay 
                            summary={summary} 
                            onChange={handleSummaryChange} 
                            onSave={handleSaveSummary} 
                            isEditing={isEditing}
                        />

                        <div className="mt-4 flex justify-center">
                            <button
                                onClick={() => setIsEditing(!isEditing)}
                                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
                            >
                                {isEditing ? '編集をキャンセル' : '編集する'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-gray-50">
            {/* 会話ヘッダー */}
            <ConversationHeader 
                onEndSession={handleEndSession}
                isProcessing={isProcessing}
                isDisabled={conversationEnded}
            />
            
            {/* メッセージ一覧 */}
            <MessageList 
                messages={messages}
                messagesEndRef={messagesEndRef}
            />
            
            {/* 音声再生用の非表示オーディオ要素 */}
            <audio ref={audioElementRef} className="hidden" />
            
            {/* 入力エリア */}
            <InputArea
                isListening={isListening}
                isProcessing={isProcessing}
                currentTranscript={currentTranscript}
                toggleListening={handleToggleMic}
                onSendMessage={handleSendMessage}
                isDisabled={conversationEnded}
            />
        </div>
    );
} 