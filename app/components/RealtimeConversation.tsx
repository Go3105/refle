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

// 型定義がなければグローバル宣言
// Web Speech API 型定義（最低限）
interface MySpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    running: boolean;
    startPending: boolean;
    start(): void;
    stop(): void;
    onresult: ((event: MySpeechRecognitionEvent) => void) | null;
    onend: (() => void) | null;
    onaudioend: (() => void) | null;
    onspeechstart: (() => void) | null;
    onspeechend: (() => void) | null;
}
interface MySpeechRecognitionEvent extends Event {
    results: MySpeechRecognitionResultList;
}
interface MySpeechRecognitionResultList {
    length: number;
    [index: number]: MySpeechRecognitionResult;
}
interface MySpeechRecognitionResult {
    0: MySpeechRecognitionAlternative;
    isFinal: boolean;
    length: number;
}
interface MySpeechRecognitionAlternative {
    transcript: string;
    confidence: number;
}
declare global {
    interface Window {
        SpeechRecognition: { new(): MySpeechRecognition };
        webkitSpeechRecognition: { new(): MySpeechRecognition };
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

    // Refオブジェクト
    const socketRef = useRef<Socket | null>(null);              // Socket.IOインスタンス
    const recognitionRef = useRef<MySpeechRecognition | null>(null);                   // SpeechRecognitionインスタンス
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
                    } else {
                        // 従来のロジック（互換性のため）
                        setTimeout(() => {
                            // 音声認識が既に動作していなければ開始を試みる
                            if (!isListening && !isProcessing) {
                                console.log('音声認識を開始します（従来のモード）');

                                // すぐに一回目の試行
                                startListening();

                                // 失敗した場合のバックアップとして複数回試行
                                setTimeout(() => {
                                    if (!isListening && !isProcessing) {
                                        console.log('音声認識開始バックアップ試行 (1/2)');
                                        startListening();

                                        // 最後の試行
                                        setTimeout(() => {
                                            if (!isListening && !isProcessing) {
                                                console.log('音声認識開始バックアップ試行 (2/2)');
                                                startListening();
                                            }
                                        }, 2000);
                                    }
                                }, 1000);
                            } else {
                                console.log('音声認識は既に実行中または処理中のため開始しません');
                            }
                        }, 500);
                    }
                });

                // 音声合成リクエスト
                socket.on('speech-request', async (data) => {
                    console.log('音声合成リクエスト:', data);
                    try {
                        // 音声認識は停止せず、継続させる（エコーは気にしない）
                        // 代わりに、音声の音量を制御する

                        console.log('ElevenLabs APIリクエスト送信中...');
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
                            const errorData = await response.json();
                            console.error('音声合成APIエラー:', errorData);
                            throw new Error(`音声合成APIエラー: ${errorData.error || response.statusText}`);
                        }

                        console.log('音声合成API呼び出し成功、音声データを処理中...');
                        const audioBlob = await response.blob();
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

                            // 音声再生終了後も音声認識は継続中なので特に何もしない
                        };

                        audio.onerror = (error) => {
                            console.error('音声再生エラー:', error);
                            URL.revokeObjectURL(audioUrl);
                        };

                        // ソースを設定してから
                        audio.src = audioUrl;
                        audioRef.current = audio;

                        // 自動再生の問題に対処
                        try {
                            // ミュートして再生を試みる
                            audio.volume = 0;
                            await audio.play();

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
                        } catch (playError) {
                            console.error('音声自動再生エラー:', playError);
                        }
                    } catch (error) {
                        console.error('音声合成エラー:', error);
                        // エラーメッセージをユーザーに表示
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: '※音声合成エラーが発生しました。テキストのみで会話を続けます。'
                        }]);

                        // Socket.IOサーバーにエラーを通知
                        if (socketRef.current) {
                            socketRef.current.emit('tts-error', { error: error.message });
                        }
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

    /**
     * 音声認識の初期化
     * Web Speech APIを使用して音声認識機能を初期化し、各種イベントハンドラーを設定する
     */
    useEffect(() => {
        // 初期化されていない場合は何もしない
        if (!isInitialized) return;

        console.log('音声認識の初期化を開始します...');

        // ブラウザがWeb Speech APIをサポートしているか確認
        if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
            // ブラウザ固有の実装を取得
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

            // 既存のインスタンスがあれば一旦クリーンアップ
            if (recognitionRef.current) {
                try {
                    console.log('既存の音声認識インスタンスをクリーンアップします');
                    // イベントハンドラーの解除
                    recognitionRef.current.onend = null;
                    recognitionRef.current.onresult = null;
                    recognitionRef.current.onaudioend = null;
                    recognitionRef.current.onspeechstart = null;
                    recognitionRef.current.onspeechend = null;

                    // 実行中なら停止
                    if (recognitionRef.current.running) {
                        recognitionRef.current.stop();
                    }
                } catch (error) {
                    console.error('以前の音声認識インスタンスの停止エラー:', error);
                }
            }

            // 新しいインスタンスを作成
            console.log('新しい音声認識インスタンスを作成します');
            const recognition = new SpeechRecognition();
            recognition.continuous = true;    // 継続的な認識を有効化（認識終了後も自動的に再開）
            recognition.interimResults = true; // 中間結果も取得（認識中のテキストをリアルタイム表示）
            recognition.lang = 'ja-JP';        // 日本語で認識

            // 状態追跡フラグを初期化
            recognition.running = false;       // 実行中フラグ
            recognition.startPending = false;  // 開始保留フラグ

            /**
             * 音声認識結果イベントハンドラー
             * 音声認識結果を取得し、確定結果の場合はメッセージとして送信
             */
            recognition.onresult = (event: MySpeechRecognitionEvent) => {
                const results = Array.from(event.results);
                const transcript = results
                    .map((result: MySpeechRecognitionResult) => result[0])
                    .map((result: MySpeechRecognitionAlternative) => result.transcript)
                    .join('');
                const isFinal = results.some((result: MySpeechRecognitionResult) => result.isFinal);

                console.log('音声認識結果:', transcript, isFinal ? '(確定)' : '(中間)');
                setCurrentTranscript(transcript);

                // 確定結果がある場合はメッセージを送信
                if (isFinal && transcript.trim() && !isProcessing) {
                    handleSendMessage(transcript);
                }
            };

            /**
             * 音声認識終了イベントハンドラー
             * 音声認識が終了したときに自動的に再開する処理
             */
            recognition.onend = () => {
                console.log('音声認識が終了しました');

                // フラグを更新
                if (recognition) {
                    recognition.running = false;
                }

                // 手動で停止された場合は再開しない
                if (isListening && !isProcessing) {
                    console.log('音声認識を自動的に再開します');

                    // 少し遅延させてから再開（連続再開防止）
                    setTimeout(() => {
                        if (isListening && !isProcessing) {
                            try {
                                recognition.running = true;
                                recognition.start();
                                console.log('音声認識が再開されました');
                            } catch (error) {
                                console.error('音声認識の自動再開に失敗:', error);
                                if (error.message && error.message.includes('already started')) {
                                    recognition.running = true;
                                } else {
                                    // 最後のリカバリー試行
                                    setTimeout(() => {
                                        if (isListening && !isProcessing) {
                                            try {
                                                recognition.running = true;
                                                recognition.start();
                                            } catch (lastError) {
                                                console.error('音声認識の最終再開試行に失敗:', lastError);
                                                recognition.running = false;
                                                // UIを更新してユーザーに通知
                                                setIsListening(false);
                                            }
                                        }
                                    }, 500);
                                }
                            }
                        }
                    }, 300);
                } else {
                    console.log('音声認識は停止されました（自動再開なし）');
                }
            };

            /**
             * 音声検出開始イベントハンドラー
             * ユーザーの発話開始を検出
             */
            recognition.onspeechstart = () => {
                console.log('音声入力開始を検出しました');
            };

            /**
             * 音声検出終了イベントハンドラー
             * ユーザーの発話区切りを検出
             */
            recognition.onspeechend = () => {
                console.log('音声入力の区切りを検出しました');
                // ここでは何もしない - 自動送信はonresultのisFinalで処理
            };

            // 音声認識オブジェクトを保存
            recognitionRef.current = recognition;

            // エコーキャンセリングの初期化
            echoCancellationRef.current = new EchoCancellation();

            // イベントハンドラーの設定後、少し遅延させてから開始を試みる
            setTimeout(() => {
                console.log('初期化後、音声認識の開始を試みます');
                if (!isListening && !isProcessing) {
                    startListening();
                }
            }, 1000);
        } else {
            // ブラウザが音声認識をサポートしていない場合
            console.error('このブラウザはWeb Speech APIをサポートしていません');
            alert('お使いのブラウザは音声認識をサポートしていません。Chrome、Edge、Safariなどの最新ブラウザをお試しください。');
        }
    }, [isInitialized, isListening, isProcessing]);

    /**
     * コンポーネント初期化処理
     * コンポーネントのマウント時に一度だけ初期化フラグを設定
     */
    useEffect(() => {
        // 一度だけ初期化フラグを設定
        if (!isInitialized) {
            console.log('コンポーネントの初期化を開始します...');
            setIsInitialized(true);
        }
    }, []);

    /**
     * メッセージスクロール処理
     * 新しいメッセージが追加されたときに自動的に最下部にスクロール
     */
    useEffect(() => {
        // 新しいメッセージが追加されたらスクロールを一番下に移動
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    /**
     * 音声認識の開始/停止を切り替える関数
     * ボタンクリック時に呼び出され、現在の状態に応じて音声認識を開始または停止する
     */
    const toggleListening = () => {
        if (isListening) {
            stopListening();
        } else {
            startListening();
        }
    };

    /**
     * 音声認識を開始する関数
     * Web Speech APIを使用して音声認識を開始し、状態を更新する
     * 失敗した場合は自動的に再試行する
     */
    const startListening = async () => {
        // 音声認識が利用可能かチェック
        if (!recognitionRef.current) {
            console.log('音声認識を開始できません: SpeechRecognitionが初期化されていません');
            // 音声認識が初期化されていない場合は、初期化を試みる
            if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
                console.log('音声認識の初期化を再試行します...');
                setIsInitialized(false);
                setTimeout(() => setIsInitialized(true), 500);
            }
            return;
        }

        // 処理中は開始しない
        if (isProcessing) {
            console.log('音声認識を開始できません: 処理中です');
            return;
        }

        // 既に実行中なら何もしない
        if (isListening || (recognitionRef.current && recognitionRef.current.running)) {
            console.log('音声認識は既に実行中です。状態を更新するだけにします。');
            setIsListening(true);
            return;
        }

        console.log('音声認識を開始します...');
        setCurrentTranscript('');
        setIsListening(true);

        try {
            // マイクへのアクセスを取得
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // エコーキャンセリングを開始
            if (echoCancellationRef.current && audioRef.current) {
                const audioStream = (audioRef.current as HTMLAudioElement & { captureStream: () => MediaStream }).captureStream();
                await echoCancellationRef.current.start(stream, audioStream);
            }

            // まずフラグを設定
            recognitionRef.current.running = true;

            // 直接開始を試みる
            recognitionRef.current.start();
            console.log('音声認識が開始されました');

            // マイクへのアクセス許可を促すメッセージ（初回のみ）
            if (!initRef.current.speechInitialized) {
                console.log('音声認識の初回開始: マイクの許可が必要かもしれません');
                initRef.current.speechInitialized = true;
            }
        } catch (error) {
            console.error('音声認識開始エラー:', error);

            // 既に開始されている場合は無視
            if (error.message && error.message.includes('already started')) {
                console.log('音声認識は既に開始されています');
                recognitionRef.current.running = true;
            } else {
                // その他のエラーは状態をリセット
                recognitionRef.current.running = false;
                setIsListening(false);

                // 再試行
                setTimeout(() => {
                    if (!isListening && !isProcessing) {
                        console.log('音声認識再試行...');
                        startListening();
                    }
                }, 1000);
            }
        }
    };

    /**
     * 音声認識を停止する関数
     * 実行中の音声認識を停止し、必要に応じて最後の認識テキストを送信する
     */
    const stopListening = () => {
        if (!recognitionRef.current) {
            console.log('音声認識を停止できません: recognitionRef不在');
            return;
        }

        console.log('音声認識を停止します');
        setIsListening(false);

        // 最後の文章を送信（停止前に）
        if (currentTranscript.trim() && !isProcessing) {
            handleSendMessage(currentTranscript);
            return; // handleSendMessageの中で停止するので、ここでは早期リターン
        }

        try {
            if (recognitionRef.current.running) {
                recognitionRef.current.running = false;
                recognitionRef.current.stop();
            }
        } catch (error) {
            console.error('音声認識停止エラー:', error);
        }

        // エコーキャンセリングを停止
        if (echoCancellationRef.current) {
            echoCancellationRef.current.stop();
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

        // 音声認識を一時停止
        if (recognitionRef.current && (isListening || recognitionRef.current.running)) {
            console.log('メッセージ送信中は音声認識を停止します');
            setIsListening(false);
            try {
                recognitionRef.current.running = false;
                recognitionRef.current.startPending = false;
                recognitionRef.current.stop();
            } catch (error) {
                console.error('音声認識停止エラー:', error);
            }
        }

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

        // エコーキャンセリングを停止
        if (echoCancellationRef.current) {
            echoCancellationRef.current.stop();
        }
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