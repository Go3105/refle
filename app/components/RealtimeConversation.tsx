/**
 * app/components/RealtimeConversation.tsx
 * ===========================================
 * リアルタイム音声会話インターフェースを提供するReactコンポーネント
 * 
 * このコンポーネントは以下の機能を提供します：
 * 1. Socket.IOを使用したリアルタイム通信
 * 2. Web Speech APIによる音声認識（SpeechRecognition）
 * 3. AIからの応答の表示と音声合成によるフィードバック
 * 4. 会話UIと音声制御ボタン
 */
'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { EchoCancellation } from '@/lib/echoCancellation';

// Socket.IOの型定義のみをインポート
import type { Socket } from 'socket.io-client';

/**
 * メッセージデータの型定義
 * 会話の各メッセージを表現する型
 */
interface Message {
    role: 'user' | 'assistant';  // メッセージの送信者
    content: string;             // メッセージの内容
}

// Web Speech API 型定義
type SpeechRecognitionEvent = {
    resultIndex: number;
    results: {
        [index: number]: {
            isFinal: boolean;
            0: {
                transcript: string;
                confidence: number;
            };
            length: number;
        };
        length: number;
    };
};

type SpeechRecognitionErrorEvent = {
    error: string;
    message?: string;
};

interface SpeechRecognition {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    maxAlternatives?: number;
    start(): void;
    stop(): void;
    abort?(): void;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onend: (() => void) | null;
    onaudioend: (() => void) | null;
    onaudiostart: (() => void) | null;
    onspeechstart: (() => void) | null;
    onspeechend: (() => void) | null;
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
    onnomatch?: (() => void) | null;
}

declare global {
    interface Window {
        SpeechRecognition: new () => SpeechRecognition;
        webkitSpeechRecognition: new () => SpeechRecognition;
    }
}

export default function RealtimeConversation() {
    // ステート変数
    const [isConnected, setIsConnected] = useState(false);       // Socket.IO接続状態
    const [isListening, setIsListening] = useState(false);       // 音声認識状態
    const [messages, setMessages] = useState<Message[]>([]);     // 会話メッセージ履歴
    const [currentTranscript, setCurrentTranscript] = useState(''); // 現在の音声認識テキスト
    const [isProcessing, setIsProcessing] = useState(false);     // AI処理中フラグ
    const [isInitialized, setIsInitialized] = useState(false);   // 初期化状態フラグ
    const [summary, setSummary] = useState<string>('');          // 会話サマリ
    const [editableSummary, setEditableSummary] = useState<string>(''); // 編集可能なサマリ
    const [showingSummary, setShowingSummary] = useState(false); // サマリ表示状態

    // Refオブジェクト
    const socketRef = useRef<Socket | null>(null);              // Socket.IOインスタンス
    const recognitionRef = useRef<SpeechRecognition | null>(null); // SpeechRecognitionインスタンス
    const messagesEndRef = useRef<HTMLDivElement>(null);        // メッセージ末尾への参照（自動スクロール用）
    const audioRef = useRef<HTMLAudioElement | null>(null);     // 音声再生用Audio要素
    const echoCancellationRef = useRef<EchoCancellation | null>(null);

    /**
     * マウント状態の追跡
     * コンポーネントがマウントされているかを追跡し、アンマウント後の処理を防止
     */
    const isMountedRef = useRef(true);
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    /**
     * 初期化状態の追跡
     * 各機能の初期化状態を追跡するためのオブジェクト
     */
    const initRef = useRef({
        speechInitialized: false,    // 音声認識の初期化状態
        socketInitialized: false,    // Socket.IOの初期化状態
        retryAttempt: 0              // 再試行回数
    });

    /**
     * Socket.IOの接続設定
     * サーバーとのリアルタイム接続を確立し、各種イベントハンドラーを設定
     */
    useEffect(() => {
        let isMounted = true;
        let speechInitialized = false;

        /**
         * Socket.IO初期化関数
         * Socket.IOクライアントを初期化し、サーバーとの接続を確立
         */
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
                    path: '/api/socketio',          // Socket.IOサーバーのパス
                    reconnectionAttempts: 10,       // 再接続試行回数
                    reconnectionDelay: 1000,        // 再接続間隔（ミリ秒）
                    timeout: 60000,                 // 接続タイムアウト（60秒）
                    transports: ['websocket', 'polling'], // 通信方式
                    autoConnect: true               // 自動接続を有効化
                });

                // 接続エラーイベントの処理を追加
                socket.on('connect_error', (err) => {
                    console.error('Socket.IO接続エラー:', err);
                    if (isMounted) setIsConnected(false);
                });

                socketRef.current = socket;

                /**
                 * 接続イベントハンドラー
                 * Socket.IO接続成功時の処理
                 */
                socket.on('connect', () => {
                    console.log('Socket.IO接続成功:', socket.id);
                    setIsConnected(true);

                    // 接続成功時に音声認識の初期化と開始（一度だけ）
                    if (!speechInitialized && isMounted) {
                        speechInitialized = true;
                        // 少し遅延させて音声認識を開始（ready-for-next-inputイベントからの開始に任せる）
                        console.log('音声認識の初期化を待機します...');

                        // 即座に音声認識を開始（継続リスニング状態を維持）
                        setTimeout(() => {
                            startListening();
                        }, 1000);
                    }
                });

                /**
                 * AIの応答受信イベントハンドラー
                 * サーバーからAI応答テキストを受信したときの処理
                 */
                socket.on('ai-response', (data) => {
                    console.log('AI応答受信:', data);
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: data.text
                    }]);
                    setIsProcessing(false);
                });

                /**
                 * 次の入力準備完了イベントハンドラー
                 * サーバーから次の入力準備が完了したという通知を受け取ったときの処理
                 */
                socket.on('ready-for-next-input', (data) => {
                    console.log('次の入力準備完了:', data);

                    // keep_listeningフラグが設定されている場合は、既に実行中でなければ開始
                    const shouldKeepListening = data.keep_listening === true;

                    if (shouldKeepListening) {
                        if (!isListening && !isProcessing) {
                            console.log('音声認識を開始します（継続リスニングモード）');
                            // すぐに開始試行
                            startListening();
                        } else {
                            console.log('音声認識は既に実行中なので継続します');
                        }
                    }
                });

                /**
                 * 音声ストリーム受信イベントハンドラー
                 * AIの応答音声データを受信したときの処理（バイナリデータをBase64デコードして再生）
                 */
                socket.on('audio-stream', (data) => {
                    console.log('音声ストリーム受信:', data.text.substring(0, 30) + '...');
                    
                    try {
                        // Base64エンコードされた音声データをデコード
                        const audioData = atob(data.audio);
                        
                        // バイナリデータに変換
                        const byteNumbers = new Array(audioData.length);
                        for (let i = 0; i < audioData.length; i++) {
                            byteNumbers[i] = audioData.charCodeAt(i);
                        }
                        const byteArray = new Uint8Array(byteNumbers);
                        
                        // Blobを作成
                        const audioBlob = new Blob([byteArray], { type: data.contentType });
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
                        
                        // イベントハンドラを先に設定
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
                });

                /**
                 * 音声合成状態イベントハンドラー
                 * 音声合成の進行状況を受信して処理
                 */
                socket.on('tts-status', (data) => {
                    console.log('音声合成状態:', data);
                    // 必要に応じてUIに表示
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
            // クリーンアップ処理
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current.removeAllListeners();
                socketRef.current = null;
            }
            stopListening();
        };
    }, [isListening, isProcessing]);

    /**
     * メッセージスクロール処理
     * 新しいメッセージが追加されたときに自動的に最下部にスクロール
     */
    useEffect(() => {
        // 新しいメッセージが追加されたらスクロールを一番下に移動
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    /**
     * 音声認識の開始
     * Web Speech APIのSpeechRecognitionを初期化し、音声認識を開始する
     */
    const startListening = async () => {
        try {
            console.log('音声認識を開始します...');
            
            // 既存のインスタンスがあれば停止
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop();
                } catch (e) {
                    console.log('既存の音声認識セッション停止エラー:', e);
                    // エラーは無視して続行
                }
            }

            // ブラウザAPIのチェック
            if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
                throw new Error('このブラウザは音声認識をサポートしていません');
            }

            // SpeechRecognitionインスタンスの生成
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            const recognition = new SpeechRecognition();

            // 基本設定
            recognition.lang = 'ja-JP';          // 日本語
            recognition.interimResults = true;   // 中間結果を有効化
            recognition.continuous = true;       // 継続モードを有効化（重要）

            // 音声認識結果イベントハンドラー
            recognition.onresult = (event: SpeechRecognitionEvent) => {
                // 記事のサンプルコードを参考にした実装
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const results = event.results;
                    if (results[i].isFinal) {
                        console.log('音声認識確定結果:', results[i][0].transcript);
                        
                        // 確定結果が有効な場合のみ処理
                        const transcript = results[i][0].transcript.trim();
                        if (transcript.length > 1 && !isProcessing) {
                            // メッセージリストに追加
                            setMessages(prev => [...prev, {
                                role: 'user',
                                content: transcript
                            }]);
                            
                            // Socket.IOで送信
                            if (socketRef.current) {
                                socketRef.current.emit('user-speech', transcript);
                                setIsProcessing(true);
                            }
                        }
                        
                        // 入力欄をクリア
                        setCurrentTranscript('');
                    } else {
                        // 中間結果の表示
                        console.log('音声認識中間結果:', results[i][0].transcript);
                        setCurrentTranscript(results[i][0].transcript);
                    }
                }
            };

            // 音声認識終了イベントハンドラー - 常に再開する（記事の実装を参考に）
            recognition.onend = () => {
                console.log('音声認識が終了しました、自動的に再開します');
                
                // 処理中でなければすぐに再開
                if (!isProcessing && isMountedRef.current) {
                    try {
                        // 少し遅延させてから再開（連続再開防止）
                        setTimeout(() => {
                            recognition.start();
                        }, 100);
                    } catch (e) {
                        console.error('音声認識再開エラー:', e);
                    }
                } else {
                    console.log('処理中のため音声認識再開を一時停止します');
                }
            };

            // エラーイベントハンドラー
            recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
                console.error('音声認識エラー:', event.error);
                
                // 'no-speech' エラーは無視して再開を試みる（無音時の自動停止対策）
                if (event.error === 'no-speech' && isMountedRef.current) {
                    console.log('無音検出のため再開を試みます');
                    setTimeout(() => {
                        try {
                            recognition.start();
                        } catch (e) {
                            console.error('エラー後の再開失敗:', e);
                        }
                    }, 100);
                }
            };

            // 音声認識開始
            recognition.start();
            recognitionRef.current = recognition;
            setIsListening(true);
            
        } catch (error) {
            console.error('音声認識初期化エラー:', error);
            setIsListening(false);
            
            // 'already-started' エラーは無視（既に開始されている）
            if (error.message && error.message.includes('already started')) {
                console.log('音声認識は既に開始されています');
                setIsListening(true);
            } else {
                // 重大なエラーの場合はユーザーに通知
                alert('音声認識の開始に失敗しました: ' + error.message);
            }
        }
    };

    /**
     * 音声認識の停止
     * 実行中の音声認識セッションを停止する
     */
    const stopListening = () => {
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
                recognitionRef.current = null;
            } catch (e) {
                console.error('音声認識停止エラー:', e);
            }
        }
        setIsListening(false);
        setCurrentTranscript('');
    };

    /**
     * 音声認識のトグル操作
     * 音声認識の開始・停止を切り替える
     */
    const toggleListening = () => {
        if (isListening) {
            stopListening();
        } else {
            startListening();
        }
    };

    /**
     * メッセージを送信する関数
     * ユーザーの音声認識テキストをサーバーに送信し、会話履歴に追加する
     * 
     * @param {string} text - 送信するテキストメッセージ
     */
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

    /**
     * セッションを終了する関数
     * 音声認識と音声再生を停止し、Socket.IO接続を切断して状態をリセットする
     */
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

        // エコーキャンセリングを停止
        if (echoCancellationRef.current) {
            echoCancellationRef.current.stop();
        }

        // サマリを生成して表示
        createSummary();
        
        // リセット
        setIsListening(false);
        setCurrentTranscript('');
        setIsProcessing(false);
        
        // Socket.IO接続を切断（サマリ生成後に切断）
        setTimeout(() => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
            setIsConnected(false);
        }, 1000);
    };

    /**
     * 会話サマリを生成する関数
     * 会話履歴を基にAIがサマリを生成する
     */
    const createSummary = async () => {
        try {
            // サマリ作成中フラグを設定
            setIsProcessing(true);
            
            const res = await fetch('/api/gemini', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ createSummary: true }),
            });
            const data = await res.json();
            
            // サマリをステートに保存
            setSummary(data.summary);
            setEditableSummary(data.summary);
            setShowingSummary(true);
            
            // 処理完了
            setIsProcessing(false);
        } catch (error) {
            console.error('サマリ作成エラー:', error);
            setIsProcessing(false);
        }
    };

    /**
     * サマリテキストの変更ハンドラ
     * テキストエリアの内容が変更されたときに呼び出される
     * 
     * @param {React.ChangeEvent<HTMLTextAreaElement>} e - イベントオブジェクト
     */
    const handleSummaryChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setEditableSummary(e.target.value);
    };

    /**
     * サマリの保存ハンドラ
     * 編集したサマリをステートに保存する
     */
    const handleSummarySave = () => {
        setSummary(editableSummary);
    };

    /**
     * コンポーネントのレンダリング
     * 会話インターフェースのUI要素を構築して返す
     */
    return (
        <div className="flex flex-col h-full">
            {/* ヘッダー部分 - タイトルと接続状態、終了ボタンを表示 */}
            <header className="flex justify-between items-center p-4 bg-pink-50 shadow-sm">
                <h1 className="text-xl font-bold">リアルタイム音声会話</h1>
                <div className="flex items-center gap-3">
                    {/* 接続状態インジケーター */}
                    <div className={`h-3 w-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span>{isConnected ? 'オンライン' : '接続中...'}</span>
                    {/* 終了ボタン */}
                    <button
                        onClick={handleEndSession}
                        className="px-4 py-2 bg-pink-100 rounded-lg hover:bg-pink-200"
                    >
                        終了
                    </button>
                </div>
            </header>

            {/* メッセージ表示エリア - 会話履歴を表示するスクロール可能な領域 */}
            <div className="flex-1 overflow-auto p-4 bg-gray-50">
                <div className="max-w-3xl mx-auto">
                    {/* メッセージの配列をマッピングして表示 */}
                    {messages.map((message, index) => (
                        <div
                            key={index}
                            className={`mb-4 ${message.role === 'user'
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
                            <div>
                                <p>{message.content}</p>
                            </div>
                        </div>
                    ))}
                    {/* サマリ表示部分 */}
                    {showingSummary && (
                        <div className="mt-8 p-4 bg-white rounded-lg shadow">
                            <h2 className="text-lg font-bold mb-2">会話のサマリ</h2>
                            <form className="space-y-3">
                                <textarea 
                                    className="w-full p-2 border rounded-md min-h-[150px]"
                                    value={editableSummary}
                                    onChange={handleSummaryChange}
                                ></textarea>
                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        onClick={handleSummarySave}
                                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        保存
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                    {/* 自動スクロール用の参照ポイント */}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* 入力エリア - 現在の認識テキスト表示と音声認識制御ボタン */}
            <div className="p-4 bg-white border-t">
                <div className="max-w-3xl mx-auto flex items-center gap-2">
                    {/* 現在の状態に応じて表示を変更する入力テキストエリア */}
                    <div className={`flex-1 p-3 min-h-16 border rounded-lg ${isProcessing ? 'bg-pink-50' :
                        isListening ? 'bg-green-50 animate-pulse' : 'bg-gray-50'
                        }`}>
                        {isProcessing ?
                            <div className="flex items-center">
                                <span className="mr-2">AIが考え中...</span>
                                <div className="w-4 h-4 rounded-full bg-pink-300 animate-ping"></div>
                            </div> :
                            (currentTranscript ?
                                <div className="break-words">{currentTranscript}</div> :
                                (isListening ?
                                    <div className="flex items-center">
                                        <span className="mr-2">聞いています...</span>
                                        <div className="w-4 h-4 rounded-full bg-green-300 animate-bounce"></div>
                                    </div> :
                                    '話しかけてください'
                                )
                            )
                        }
                    </div>
                    {/* 音声認識の開始/停止ボタン */}
                    <button
                        onClick={toggleListening}
                        disabled={isProcessing}
                        className={`p-3 rounded-full ${isProcessing ? 'bg-gray-400 text-white cursor-not-allowed' :
                            isListening ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'
                            } transition-all duration-300 hover:scale-110`}
                        title={isListening ? "音声認識を停止" : "音声認識を開始"}
                    >
                        {/* 状態に応じてアイコンを切り替え */}
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
                {/* 操作ガイドメッセージ */}
                <div className="max-w-3xl mx-auto mt-2 text-center text-sm text-gray-500">
                    {isListening ?
                        "自動で音声を認識しています。止めたい場合はボタンを押してください" :
                        (isProcessing ? "AIが応答を考えています..." : "マイクボタンは手動での会話制御に使えます")}
                </div>
            </div>
        </div>
    );
} 