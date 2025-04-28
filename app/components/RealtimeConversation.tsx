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
import { shouldEndConversation, createEndConversationMessages } from '@/app/lib/conversation/conversationRules';

/**
 * メッセージデータの型定義
 * 会話の各メッセージを表現する型
 */
export interface Message {
    role: 'user' | 'assistant';  // メッセージの送信者
    content: string;             // メッセージの内容
    timestamp?: number;          // 送信タイムスタンプ
}

// 会話の状態を表す型定義
type ConversationStatus =
    | 'idle'           // 待機中
    | 'listening'      // 音声認識中
    | 'processing'     // AI処理中
    | 'summarizing'    // サマリ生成中
    | 'summary_ready'  // サマリ生成完了
    | 'ended';         // 会話終了

interface SpeechRequest {
    text: string;
}

export default function RealtimeConversation() {
    // ステート変数
    const [messages, setMessages] = useState<Message[]>([]);     // 会話メッセージ履歴
    const [status, setStatus] = useState<ConversationStatus>('idle'); // 会話の状態
    const [conversationEnded, setConversationEnded] = useState(false); // 会話終了フラグ
    const [micPermission, setMicPermission] = useState<boolean | null>(null); // マイク許可状態
    const [recognitionRestart, setRecognitionRestart] = useState(false); // 音声認識再開フラグ
    const [conversationStartTime, setConversationStartTime] = useState<number | null>(null); // 会話開始時間
    const [isProcessing, setIsProcessing] = useState(false);     // AI処理中フラグ

    // Refオブジェクト
    const messagesEndRef = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>;        // メッセージ末尾への参照（自動スクロール用）
    const isMountedRef = useRef(true);
    const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null); // 処理タイムアウト用
    const audioElementRef = useRef<HTMLAudioElement>(null);     // 音声再生用Audio要素
    const socketRefInternal = useRef<Socket | null>(null);      // Socket.IO参照用の内部Ref
    const recognitionTimerRef = useRef<NodeJS.Timeout | null>(null); // 音声認識再開タイマー

    // イベント結果を追跡（二重処理防止）
    const lastEventTimeRef = useRef<{ [key: string]: number }>({
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

                    // 初回接続時に会話開始時間を設定
                    if (!conversationStartTime) {
                        setConversationStartTime(Date.now());
                    }
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

    // 会話時間の監視
    useEffect(() => {
        if (!conversationStartTime) {
            console.log('会話開始時間が設定されていません');
            return;
        }

        console.log('会話開始時間:', new Date(conversationStartTime).toISOString());
        console.log('現在時刻:', new Date().toISOString());
        console.log('経過時間:', (Date.now() - conversationStartTime) / 1000, '秒');

        let isEnding = false;  // 終了処理中フラグ

        const endConversation = () => {
            if (isEnding || conversationEnded) {
                console.log('既に終了処理中または終了済みのため、終了処理をスキップします');
                return;
            }
            isEnding = true;

            console.log('会話開始から60秒経過しました。会話を終了します');
            console.log('終了時の経過時間:', (Date.now() - conversationStartTime) / 1000, '秒');

            // 会話終了フラグを設定
            setConversationEnded(true);
            setStatus('ended');

            // 終了メッセージを追加
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: '会話が終了しました。ありがとうございました。',
                timestamp: Date.now()
            }]);

            // 音声認識を停止
            stopListening();

            // Socket接続を切断
            if (socketRef?.current) {
                console.log('Socket接続を切断します');
                socketRef.current.emit('end-session');
                disconnect();
            }
        };

        const currentTime = Date.now();
        const elapsedTime = currentTime - conversationStartTime;

        console.log('タイマー設定時の経過時間:', elapsedTime / 1000, '秒');

        // 既に60秒経過しているかチェック
        if (elapsedTime >= 60000) {
            console.log('既に60秒経過しているため、即座に終了処理を実行します');
            endConversation();
            return;
        }

        // 残り時間を計算してタイマーを設定
        const timeUntilEnd = 60000 - elapsedTime;
        console.log('タイマーを設定します。残り時間:', timeUntilEnd / 1000, '秒');

        const timeoutId = setTimeout(() => {
            console.log('タイマーが発火しました');
            endConversation();
        }, timeUntilEnd);

        // クリーンアップ関数
        return () => {
            if (timeoutId) {
                console.log('タイマーをクリアします');
                clearTimeout(timeoutId);
            }
        };
    }, [conversationStartTime, conversationEnded, stopListening, socketRef, disconnect]);

    // 音声認識状態の変更を監視
    useEffect(() => {
        if (conversationEnded) {
            setStatus('ended');
            return;
        }

        if (isListening) {
            setStatus('listening');
        } else if (isProcessing) {
            setStatus('processing');
        } else {
            setStatus('idle');
        }
    }, [isListening, isProcessing, conversationEnded]);

    /**
     * メッセージを送信する関数
     */
    function handleSendMessage(text: string) {
        // 空のメッセージは送信しない
        if (!text.trim() || isProcessing || conversationEnded) return;

        // 会話開始時間が設定されていなければ設定
        if (!conversationStartTime) {
            setConversationStartTime(Date.now());
        }

        // 「終了」と入力されたら会話を終了
        if (text.trim() === '終了') {
            console.log('ユーザーが終了を要求しました');

            // まず会話終了フラグを設定
            setConversationEnded(true);

            // ユーザーのメッセージを追加
            const userMessage: Message = {
                role: 'user',
                content: text,
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, userMessage]);

            // 音声認識を完全に停止
            stopListening();
            setIsProcessing(false);  // 処理中フラグを明示的にリセット

            // Socket接続を切断
            if (socketRef?.current) {
                socketRef.current.emit('end-session');
                disconnect();
            }

            // 状態を更新
            setStatus('ended');

            // 終了メッセージを追加
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: '会話が終了しました。ありがとうございました。',
                timestamp: Date.now()
            }]);

            // 即座にホーム画面に戻る
            window.location.href = '/';

            return;
        }

        // 通常の会話処理
        const newMessage: Message = {
            role: 'user',
            content: text,
            timestamp: Date.now()
        };

        setMessages(prev => [...prev, newMessage]);
        setIsProcessing(true);
        setStatus('processing');

        console.log('メッセージを送信:', text);

        if (socketRef?.current) {
            socketRef.current.emit('user-speech', text);
            console.log('user-speechイベントを送信しました:', text);

            processingTimeoutRef.current = setTimeout(() => {
                if (isProcessing) {
                    console.log('AIレスポンスのタイムアウト: 処理をリセットします');
                    setIsProcessing(false);
                    setStatus('idle');

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: 'レスポンスの取得に時間がかかりすぎています。もう一度お試しください。',
                        timestamp: Date.now()
                    }]);

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
            setStatus('idle');
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
        setStatus('ended');

        // 終了メッセージを追加
        setMessages(prev => [...prev, {
            role: 'assistant',
            content: '会話が終了しました。ありがとうございました。',
            timestamp: Date.now()
        }]);

        // Socket接続を切断
        if (socketRef?.current) {
            socketRef.current.emit('end-session');
            disconnect();
        }
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
    if (micPermission === false) {
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

    return (
        <div className={styles.container}>
            <ConversationHeader
                isConnected={isConnected}
                onEndSession={handleEndSession}
                isProcessing={isProcessing}
                isDisabled={conversationEnded}
            />

            <MessageList
                messages={messages}
                messagesEndRef={messagesEndRef}
            />

            {conversationEnded && (
                <div className={styles.endForm}>
                    <div className={styles.endMessage}>
                        会話が終了しました。ありがとうございました。
                    </div>
                    <div className={styles.endActions}>
                        <button
                            onClick={handleEndSession}
                            className={styles.endButton}
                        >
                            完了
                        </button>
                    </div>
                </div>
            )}

            <InputArea
                isListening={isListening}
                isProcessing={isProcessing}
                currentTranscript={currentTranscript}
                toggleListening={handleToggleMic}
                onSendMessage={handleSendMessage}
                onEndSession={handleEndSession}
                isDisabled={conversationEnded}
            />
        </div>
    );
} 