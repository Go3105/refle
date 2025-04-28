import { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';

// Web Speech API の型拡張
interface MySpeechRecognitionEvent extends Event {
    results: {
        [index: number]: MySpeechRecognitionResult;
        length: number;
        item(index: number): MySpeechRecognitionResult;
    };
}

interface MySpeechRecognitionResult {
    [index: number]: MySpeechRecognitionAlternative;
    length: number;
    item(index: number): MySpeechRecognitionAlternative;
    isFinal: boolean;
}

interface MySpeechRecognitionAlternative {
    transcript: string;
    confidence: number;
}

interface MySpeechRecognition {
    // 標準的なプロパティ
    continuous: boolean;
    interimResults: boolean;
    lang: string;

    // イベントハンドラ
    onresult: (event: MySpeechRecognitionEvent) => void;
    onerror: (event: { error: string }) => void;
    onend: () => void;
    onspeechstart: () => void;
    onspeechend: () => void;

    // メソッド
    start: () => void;
    stop: () => void;
    abort: () => void;

    // 拡張プロパティ（カスタム）
    running?: boolean;
    startPending?: boolean;
}

// EchoCancellation クラスのインターフェース
interface EchoCancellation {
    start: (micStream: MediaStream, speakerStream: MediaStream) => Promise<void>;
    stop: () => void;
}

// プロップスの型定義
interface UseSpeechProps {
    onMessageReady: (text: string) => void;
    socketRef?: React.MutableRefObject<Socket | null>;
}

interface SpeechRecognitionError {
    error: string;
    message: string;
}

interface SpeechRecognitionEvent {
    results: {
        [index: number]: {
            [index: number]: {
                transcript: string;
            };
            length: number;
            isFinal: boolean;
        };
        length: number;
    };
}

declare global {
    interface Window {
        SpeechRecognition: new () => MySpeechRecognition;
        webkitSpeechRecognition: new () => MySpeechRecognition;
    }
}

export default function useSpeech({ onMessageReady, socketRef }: UseSpeechProps) {
    // 音声認識の状態
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [currentTranscript, setCurrentTranscript] = useState('');
    const [isInitialized, setIsInitialized] = useState(false);

    // 音声認識と音声出力の参照
    const recognitionRef = useRef<MySpeechRecognition | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const echoCancellationRef = useRef<EchoCancellation | null>(null);
    const isMountedRef = useRef(true); // コンポーネントのマウント状態追跡用

    // 初期化状態の追跡
    const initRef = useRef({
        speechInitialized: false
    });

    // 無音検出のための状態追跡
    const lastSpeechRef = useRef<number>(Date.now());
    const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);

    // 無音検出の閾値（ミリ秒）
    const SILENCE_THRESHOLD = 2500;

    // Socket.IOイベントの設定
    useEffect(() => {
        if (!socketRef?.current) return;

        // 音声合成リクエストのハンドラー
        const handleSpeechRequest = async (data: { text: string }) => {
            if (!audioRef.current) return;

            console.log('音声合成リクエスト受信:', data);

            try {
                // 音声の再生中は、現在の再生を停止して新しい音声の準備
                if (!audioRef.current.paused) {
                    audioRef.current.pause();
                }
                audioRef.current.currentTime = 0;

                // text-to-speech APIを呼び出して音声を取得
                const res = await fetch('/api/tts', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ text: data.text }),
                });

                if (!res.ok) {
                    throw new Error(`音声合成APIエラー: ${res.status}`);
                }

                // 音声データを取得してBlobに変換
                const audioBlob = await res.blob();
                const audioUrl = URL.createObjectURL(audioBlob);

                // 音声再生の準備
                audioRef.current.src = audioUrl;

                // 音声の再生を開始
                await audioRef.current.play();

                console.log('音声再生開始');

                // 再生が終了したらリソースを解放
                audioRef.current.onended = () => {
                    console.log('音声再生終了');
                    URL.revokeObjectURL(audioUrl);

                    // Socket.IOサーバーに再生完了を通知
                    if (socketRef?.current) {
                        socketRef.current.emit('speech-ended');
                    }

                    // 音声認識が停止していれば再開（会話ターン制御のため）
                    if (!isProcessing) {
                        setTimeout(() => {
                            startListening();
                        }, 300); // 少し間を置いてから次の音声認識を開始
                    }
                };

            } catch (error) {
                console.error('音声合成エラー:', error);

                // Socket.IOサーバーにエラーを通知
                if (socketRef?.current) {
                    socketRef.current.emit('tts-error', { error: (error as Error).message });
                }
            }
        };

        // イベントリスナーを登録
        socketRef.current.on('speech-request', handleSpeechRequest);

        // クリーンアップ関数
        return () => {
            if (socketRef.current) {
                socketRef.current.off('speech-request', handleSpeechRequest);
            }
        };
    }, [socketRef, isProcessing]);

    // Web Speech API初期化
    useEffect(() => {
        // 初期化されていない場合は何もしない
        if (!isInitialized) return;

        // エコーキャンセレーションクラス（仮実装）
        class EchoCancellation {
            async start(micStream: MediaStream, speakerStream: MediaStream) {
                // エコーキャンセリング処理（ライブラリか実装を追加）
                console.log('エコーキャンセリング開始');
            }

            stop() {
                console.log('エコーキャンセリング停止');
            }
        }

        // Web Speech APIの初期化
        if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
            // APIインスタンスの作成
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            const recognition = new SpeechRecognition();

            // 設定
            recognition.continuous = false;      // 単発認識モードに変更（一文認識したら停止）
            recognition.interimResults = true;   // 中間結果も取得
            recognition.lang = 'ja-JP';          // 日本語で認識

            // 状態追跡フラグ
            recognition.running = false;
            recognition.startPending = false;

            // 音声認識結果イベント
            recognition.onresult = (event: SpeechRecognitionEvent) => {
                const results = Array.from({ length: event.results.length }, (_, i) => event.results[i]);
                const transcript = results
                    .map(result => result[0])
                    .map(result => result.transcript)
                    .join('');
                const isFinal = results.some(result => result.isFinal);

                console.log('音声認識結果:', transcript, isFinal ? '(確定)' : '(中間)');

                // 中間結果なら表示を更新
                if (!isFinal) {
                    setCurrentTranscript(transcript);

                    // 音声入力中として記録
                    lastSpeechRef.current = Date.now();

                    // 既存の無音タイマーをクリア
                    if (silenceTimerRef.current) {
                        clearTimeout(silenceTimerRef.current);
                    }

                    // 新しい無音タイマーをセット
                    silenceTimerRef.current = setTimeout(() => {
                        // 一定時間発話がなければ文の区切りとみなす
                        if (Date.now() - lastSpeechRef.current >= SILENCE_THRESHOLD && transcript.trim()) {
                            console.log('無音検出により文の終了を判断:', transcript);

                            // 認識を一時停止
                            if (recognitionRef.current) {
                                recognitionRef.current.stop();
                                recognitionRef.current.running = false;
                            }

                            // 認識結果を確定して送信
                            handleSendMessage(transcript);
                        }
                    }, SILENCE_THRESHOLD);
                } else {
                    // 確定結果がある場合
                    setCurrentTranscript(transcript);

                    // 無音タイマーをクリア
                    if (silenceTimerRef.current) {
                        clearTimeout(silenceTimerRef.current);
                        silenceTimerRef.current = null;
                    }

                    // 文として意味がある長さなら送信
                    if (transcript.trim()) {
                        console.log('確定結果を送信:', transcript);

                        // 処理中でも確定結果は常に送信する
                        try {
                            if (recognitionRef.current) {
                                recognitionRef.current.stop();
                                recognitionRef.current.running = false;
                            }
                            handleSendMessage(transcript);
                        } catch (error) {
                            console.error('音声認識結果送信エラー:', error);
                        }
                    }
                }
            };

            // エラーイベント
            recognition.onerror = (event: SpeechRecognitionError) => {
                // 無視可能なエラー
                if (event.error === 'no-speech') {
                    console.log('無音検出、処理を継続します');
                    return;
                }

                // それ以外のエラーはコンソールに出力
                console.error('音声認識エラー:', event.error);

                // 中止エラーの処理（別のプロセスが音声認識を中止した場合）
                if (event.error === 'aborted') {
                    console.log('音声認識が中止されました。これは通常の操作の一部である可能性があります。');
                    if (recognitionRef.current) recognitionRef.current.running = false;

                    // 処理中でなければ、少し遅延してから再開を試みる
                    if (!isProcessing && isMountedRef.current && isListening) {
                        console.log('中止後に再起動のスケジュールを設定します');
                        setTimeout(() => {
                            if (isMountedRef.current && isListening) {
                                console.log('中止後の再開を試みます');
                                startListening();
                            } else {
                                console.log('コンポーネントがアンマウントされたか、リスニングがオフになったため再開しません');
                            }
                        }, 800);
                    } else {
                        console.log('処理中またはコンポーネントがアンマウントされたため、再開しません', {
                            isProcessing,
                            isMounted: isMountedRef.current,
                            isListening
                        });
                    }
                    return;
                }

                // 重大なエラーの場合は停止
                if (['not-allowed', 'service-not-allowed', 'network'].includes(event.error)) {
                    if (recognitionRef.current) recognitionRef.current.running = false;
                    setIsListening(false);
                }
            };

            // 音声認識終了イベント
            recognition.onend = () => {
                console.log('音声認識が終了しました');
                recognition.running = false;

                // 処理中でなければ、少し遅延してから新しい認識セッションを開始
                if (!isProcessing) {
                    setTimeout(() => {
                        if (isMountedRef.current) { // コンポーネントがマウントされている場合のみ実行
                            console.log('音声認識を再起動します (onend後)');
                            startListening();
                        }
                    }, 500);
                } else {
                    // 処理中の場合でも状態を更新
                    setIsListening(false);
                }
            };

            // 音声検出開始イベント
            recognition.onspeechstart = () => {
                console.log('音声入力開始を検出しました');
                lastSpeechRef.current = Date.now();
            };

            // 音声検出終了イベント
            recognition.onspeechend = () => {
                console.log('音声入力の区切りを検出しました');

                // 音声入力が終了したら、少し待って結果が十分でなければ認識を停止
                setTimeout(() => {
                    if (Date.now() - lastSpeechRef.current >= SILENCE_THRESHOLD && currentTranscript.trim()) {
                        console.log('音声入力終了により送信:', currentTranscript);

                        // 現在の認識を停止
                        if (recognitionRef.current) {
                            try {
                                recognitionRef.current.stop();
                                // 次の認識のための状態リセット
                                setTimeout(() => {
                                    if (isMountedRef.current && !isProcessing) {
                                        console.log('音声認識を再開します (onspeechend後)');
                                        startListening();
                                    }
                                }, 500);
                            } catch (error) {
                                console.error('音声認識停止エラー (onspeechend):', error);
                            }
                        }

                        // 現在の結果を送信
                        handleSendMessage(currentTranscript);
                    } else if (!currentTranscript.trim()) {
                        // 入力がなかった場合は単に再開
                        if (recognitionRef.current && !isProcessing) {
                            try {
                                recognitionRef.current.stop();
                                setTimeout(() => {
                                    if (isMountedRef.current) {
                                        console.log('空の入力で音声認識を再開します');
                                        startListening();
                                    }
                                }, 300);
                            } catch (error) {
                                console.error('音声認識停止エラー (空の入力):', error);
                            }
                        }
                    }
                }, 300);
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
    }, [isInitialized, isListening, isProcessing, currentTranscript]);

    // コンポーネント初期化
    useEffect(() => {
        // 一度だけ初期化フラグを設定
        if (!isInitialized) {
            console.log('音声認識の初期化を開始します...', {
                windowExists: typeof window !== 'undefined',
                speechRecognitionExists: typeof window !== 'undefined' && ('SpeechRecognition' in window),
                webkitSpeechRecognitionExists: typeof window !== 'undefined' && ('webkitSpeechRecognition' in window)
            });
            setIsInitialized(true);
        }

        // マウント状態を設定
        isMountedRef.current = true;

        // クリーンアップ関数
        return () => {
            // マウント状態をリセット
            isMountedRef.current = false;

            // 音声認識を停止
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.running = false;
                    recognitionRef.current.stop();
                } catch (error) {
                    console.error('音声認識のクリーンアップでエラー:', error);
                }
            }

            // エコーキャンセリングを停止
            if (echoCancellationRef.current) {
                echoCancellationRef.current.stop();
            }

            // 無音タイマーをクリア
            if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = null;
            }
        };
    }, []);

    /**
     * 音声認識を開始する関数
     */
    const startListening = async () => {
        // 強制的にトランスクリプトをクリア（安全対策）
        setCurrentTranscript('');

        console.log('startListening 呼び出し - 開始処理を開始します', {
            isListening: isListening,
            isProcessing: isProcessing,
            recognitionRunning: recognitionRef.current?.running,
            time: Date.now()
        });

        // すでに音声認識が実行中の場合は何もしない
        if (recognitionRef.current?.running) {
            console.log('すでに音声認識が実行中です。開始処理をスキップします。');
            return;
        }

        // ここで既に処理中の場合は安全のためリターン
        if (isProcessing) {
            console.log('処理中のため音声認識は開始しません。isProcessing=', isProcessing);
            return;
        }

        try {
            // ステップ1: 既存のインスタンスの破棄
            await destroyExistingSpeechRecognition();

            // ステップ2: 新しいインスタンスの作成
            await createNewSpeechRecognition();

            // ステップ3: 実際の音声認識開始
            await beginSpeechRecognition();

        } catch (error) {
            console.error('音声認識開始の総合エラー:', error);

            // 何らかのエラーが発生した場合は状態をリセットして再試行
            setIsListening(false);
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.running = false;
                    recognitionRef.current = null;
                } catch (e) {
                    // エラーは無視
                }
            }

            // エラーの種類に応じて再試行するか決定
            if ((error as Error).message?.includes('already started')) {
                // already startedエラーの場合は、既に開始されていると見なして成功として扱う
                console.log('音声認識は既に開始されています。エラーは無視して続行します。');
                setIsListening(true);
            }
        }
    };

    /**
     * 既存の音声認識インスタンスを安全に破棄する関数
     */
    const destroyExistingSpeechRecognition = async () => {
        if (recognitionRef.current) {
            console.log('既存の音声認識インスタンスを破棄します');

            try {
                // イベントハンドラを無効化（空の関数に置き換え）
                recognitionRef.current.onend = () => { };
                recognitionRef.current.onresult = (() => { }) as (event: MySpeechRecognitionEvent) => void;
                recognitionRef.current.onerror = (() => { }) as (event: SpeechRecognitionError) => void;
                recognitionRef.current.onspeechstart = () => { };
                recognitionRef.current.onspeechend = () => { };

                // 実行中なら停止
                if (recognitionRef.current.running) {
                    try {
                        recognitionRef.current.stop();
                    } catch (error) {
                        console.log('既存インスタンス停止時のエラーは無視します');
                    }
                }

                // 完全にリセット
                recognitionRef.current = null;
                setIsListening(false);

                // 少し待機して破棄完了を確認
                await new Promise(resolve => setTimeout(resolve, 150));
                console.log('既存インスタンスの破棄完了');
            } catch (error) {
                console.error('既存インスタンスのリセットエラー:', error);
                throw new Error('既存インスタンスの破棄に失敗しました: ' + (error as Error).message);
            }
        }
    };

    /**
     * 新しい音声認識インスタンスを作成する関数
     */
    const createNewSpeechRecognition = async () => {
        if (typeof window === 'undefined' || !('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window)) {
            console.error('このブラウザはWeb Speech APIをサポートしていません');
            throw new Error('Web Speech APIがサポートされていません');
        }

        try {
            // 新しいインスタンスを作成
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            const recognition = new SpeechRecognition();

            // 設定
            recognition.continuous = false;      // 単発認識モードに変更（一文認識したら停止）
            recognition.interimResults = true;   // 中間結果も取得
            recognition.lang = 'ja-JP';          // 日本語で認識

            // 状態追跡フラグ
            recognition.running = false;

            // イベントハンドラを設定
            setupSpeechRecognitionEvents(recognition);

            // 新しいインスタンスを保存
            recognitionRef.current = recognition;
            console.log('新しい音声認識インスタンスを作成しました');
        } catch (error) {
            console.error('音声認識インスタンスの作成エラー:', error);
            throw new Error('音声認識インスタンスの作成に失敗しました: ' + (error as Error).message);
        }
    };

    /**
     * 音声認識インスタンスにイベントハンドラを設定する関数
     */
    const setupSpeechRecognitionEvents = (recognition: MySpeechRecognition) => {
        // 音声認識結果イベント
        recognition.onresult = (event: SpeechRecognitionEvent) => {
            const results = Array.from({ length: event.results.length }, (_, i) => event.results[i]);
            const transcript = results
                .map(result => result[0])
                .map(result => result.transcript)
                .join('');
            const isFinal = results.some(result => result.isFinal);

            console.log('音声認識結果:', transcript, isFinal ? '(確定)' : '(中間)');

            // 中間結果なら表示を更新
            if (!isFinal) {
                setCurrentTranscript(transcript);

                // 音声入力中として記録
                lastSpeechRef.current = Date.now();

                // 既存の無音タイマーをクリア
                if (silenceTimerRef.current) {
                    clearTimeout(silenceTimerRef.current);
                }

                // 新しい無音タイマーをセット
                silenceTimerRef.current = setTimeout(() => {
                    // 一定時間発話がなければ文の区切りとみなす
                    if (Date.now() - lastSpeechRef.current >= SILENCE_THRESHOLD && transcript.trim()) {
                        console.log('無音検出により文の終了を判断:', transcript);

                        // 認識を一時停止
                        if (recognitionRef.current) {
                            recognitionRef.current.stop();
                            recognitionRef.current.running = false;
                        }

                        // 認識結果を確定して送信
                        handleSendMessage(transcript);
                    }
                }, SILENCE_THRESHOLD);
            } else {
                // 確定結果がある場合
                setCurrentTranscript(transcript);

                // 無音タイマーをクリア
                if (silenceTimerRef.current) {
                    clearTimeout(silenceTimerRef.current);
                    silenceTimerRef.current = null;
                }

                // 文として意味がある長さなら送信
                if (transcript.trim()) {
                    console.log('確定結果を送信:', transcript);

                    // 処理中でも確定結果は常に送信する
                    try {
                        if (recognitionRef.current) {
                            recognitionRef.current.stop();
                            recognitionRef.current.running = false;
                        }
                        handleSendMessage(transcript);
                    } catch (error) {
                        console.error('音声認識結果送信エラー:', error);
                    }
                }
            }
        };

        // エラーイベント
        recognition.onerror = (event: SpeechRecognitionError) => {
            // 無視可能なエラー
            if (event.error === 'no-speech') {
                console.log('無音検出、処理を継続します');
                return;
            }

            // それ以外のエラーはコンソールに出力
            console.error('音声認識エラー:', event.error);

            // 中止エラーの処理（別のプロセスが音声認識を中止した場合）
            if (event.error === 'aborted') {
                console.log('音声認識が中止されました。これは通常の操作の一部である可能性があります。');
                if (recognitionRef.current) recognitionRef.current.running = false;

                // 処理中でなければ、少し遅延してから再開を試みる
                if (!isProcessing && isMountedRef.current && isListening) {
                    console.log('中止後に再起動のスケジュールを設定します');
                    setTimeout(() => {
                        if (isMountedRef.current && isListening) {
                            console.log('中止後の再開を試みます');
                            startListening();
                        } else {
                            console.log('コンポーネントがアンマウントされたか、リスニングがオフになったため再開しません');
                        }
                    }, 800);
                } else {
                    console.log('処理中またはコンポーネントがアンマウントされたため、再開しません', {
                        isProcessing,
                        isMounted: isMountedRef.current,
                        isListening
                    });
                }
                return;
            }

            // 重大なエラーの場合は停止
            if (['not-allowed', 'service-not-allowed', 'network'].includes(event.error)) {
                if (recognitionRef.current) recognitionRef.current.running = false;
                setIsListening(false);
            }
        };

        // 音声認識終了イベント
        recognition.onend = () => {
            console.log('音声認識が終了しました');
            recognition.running = false;

            // 処理中でなければ、少し遅延してから新しい認識セッションを開始
            if (!isProcessing) {
                setTimeout(() => {
                    if (isMountedRef.current) { // コンポーネントがマウントされている場合のみ実行
                        console.log('音声認識を再起動します (onend後)');
                        startListening();
                    }
                }, 500);
            } else {
                // 処理中の場合でも状態を更新
                setIsListening(false);
            }
        };

        // 音声検出開始イベント
        recognition.onspeechstart = () => {
            console.log('音声入力開始を検出しました');
            lastSpeechRef.current = Date.now();
        };

        // 音声検出終了イベント
        recognition.onspeechend = () => {
            console.log('音声入力の区切りを検出しました');

            // 音声入力が終了したら、少し待って結果が十分でなければ認識を停止
            setTimeout(() => {
                if (Date.now() - lastSpeechRef.current >= SILENCE_THRESHOLD && currentTranscript.trim()) {
                    console.log('音声入力終了により送信:', currentTranscript);

                    // 現在の認識を停止
                    if (recognitionRef.current) {
                        try {
                            recognitionRef.current.stop();
                            // 次の認識のための状態リセット
                            setTimeout(() => {
                                if (isMountedRef.current && !isProcessing) {
                                    console.log('音声認識を再開します (onspeechend後)');
                                    startListening();
                                }
                            }, 500);
                        } catch (error) {
                            console.error('音声認識停止エラー (onspeechend):', error);
                        }
                    }

                    // 現在の結果を送信
                    handleSendMessage(currentTranscript);
                } else if (!currentTranscript.trim()) {
                    // 入力がなかった場合は単に再開
                    if (recognitionRef.current && !isProcessing) {
                        try {
                            recognitionRef.current.stop();
                            setTimeout(() => {
                                if (isMountedRef.current) {
                                    console.log('空の入力で音声認識を再開します');
                                    startListening();
                                }
                            }, 300);
                        } catch (error) {
                            console.error('音声認識停止エラー (空の入力):', error);
                        }
                    }
                }
            }, 300);
        };
    };

    /**
     * 音声認識を実際に開始する処理
     */
    const beginSpeechRecognition = async () => {
        try {
            if (!recognitionRef.current) {
                throw new Error('SpeechRecognition インスタンスが存在しません');
            }

            // すでに実行中かどうかをチェック
            if (recognitionRef.current.running) {
                console.log('音声認識はすでに実行中です。開始処理をスキップします。');
                setIsListening(true);
                return;
            }

            recognitionRef.current.start();
            recognitionRef.current.running = true;
            setIsListening(true);

        } catch (error) {
            console.error('beginSpeechRecognition エラー:', error);

            // "already started" エラーは成功とみなす
            if ((error as Error).message?.includes('already started')) {
                console.log('音声認識は既に開始されています。状態を適切に設定します。');
                if (recognitionRef.current) {
                    recognitionRef.current.running = true;
                }
                setIsListening(true);
                return;
            }

            throw error;
        }
    };

    /**
     * 音声認識を停止する関数
     */
    const stopListening = () => {
        // 音声認識が利用可能かチェック
        if (!recognitionRef.current) {
            console.log('音声認識を停止できません: SpeechRecognitionが初期化されていません');
            return;
        }

        console.log('音声認識を停止します...');

        try {
            // 無音タイマーをクリア
            if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = null;
            }

            // 音声認識が実行中かチェック
            if (recognitionRef.current.running) {
                console.log('実行中の音声認識を停止します');
                // 音声認識を停止
                recognitionRef.current.running = false;
                recognitionRef.current.stop();
            } else {
                console.log('音声認識は既に停止しています');
            }

            // 状態を更新
            setIsListening(false);
            setCurrentTranscript(''); // トランスクリプトをクリア
        } catch (error) {
            console.error('音声認識停止エラー:', error);
            // エラーが発生しても状態をリセット
            recognitionRef.current.running = false;
            setIsListening(false);
        }
    };

    /**
     * 音声認識のトグル関数
     */
    const toggleListening = () => {
        console.log('音声認識トグル: 現在の状態 =', isListening ? 'ON' : 'OFF');

        if (isListening) {
            stopListening();
        } else {
            startListening();
        }
    };

    /**
     * メッセージを送信する関数
     */
    const handleSendMessage = (text: string) => {
        // 空のメッセージなら送信しない
        if (!text.trim()) {
            console.log('空のメッセージは送信しません');
            return;
        }

        console.log('メッセージを送信します:', text);

        // 認識を停止
        stopListening();

        // 現在の状態をログ出力
        console.log('メッセージ送信前の状態:', { isListening, isProcessing });

        // 処理中状態に設定
        setIsProcessing(true);

        // 入力フィールドをクリア
        setCurrentTranscript('');

        // 直接socketRefを使用してメッセージを送信する試み
        try {
            if (socketRef?.current) {
                console.log('直接socketRefを使用してユーザー発話を送信:', text);
                socketRef.current.emit('user-speech', text);
            }
        } catch (error) {
            console.error('Socket.IOでの直接送信エラー:', error);
        }

        // ユーザーメッセージを送信（コンポーネントのコールバック経由）
        onMessageReady(text);

        // 送信完了をログ出力
        console.log('メッセージ送信完了、処理中状態に設定:', { isProcessing: true });
    };

    // フックの戻り値
    return {
        isListening,
        isProcessing,
        currentTranscript,
        startListening,
        stopListening,
        toggleListening,
        audioRef
    };
} 