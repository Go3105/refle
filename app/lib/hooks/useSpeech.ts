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
  const SILENCE_THRESHOLD = 1500;

  // Socket.IOイベントの設定
  useEffect(() => {
    if (!socketRef?.current) return;

    // 音声合成リクエストのハンドラー
    const handleSpeechRequest = async (data: any) => {
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
      recognition.onresult = (event: MySpeechRecognitionEvent) => {
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
      recognition.onerror = (event) => {
        console.error('音声認識エラー:', event.error);
        
        // 無視可能なエラー
        if (event.error === 'no-speech') {
          console.log('無音検出、処理を継続します');
          return;
        }
        
        // 重大なエラーの場合は停止
        if (['not-allowed', 'service-not-allowed', 'network'].includes(event.error)) {
          recognition.running = false;
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
    // 状態をリセット - 音声認識が途中で終了した場合の対策
    if (recognitionRef.current && recognitionRef.current.running) {
      console.log('開始前に既存の音声認識をリセットします');
      try {
        recognitionRef.current.stop();
        recognitionRef.current.running = false;
        
        // 確実に状態をリセットするために少し待機
        setIsListening(false);
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error('音声認識リセットエラー:', error);
      }
    }
    
    // 少し遅延して再開始（安定性向上のため）
    await new Promise(resolve => setTimeout(resolve, 150));
    
    // 音声認識が利用可能かチェック
    if (!recognitionRef.current) {
      console.log('音声認識を開始できません: SpeechRecognitionが初期化されていません', {
        windowExists: typeof window !== 'undefined',
        speechRecognitionExists: typeof window !== 'undefined' && ('SpeechRecognition' in window),
        webkitSpeechRecognitionExists: typeof window !== 'undefined' && ('webkitSpeechRecognition' in window),
        isInitialized: isInitialized
      });
      
      // 音声認識が初期化されていない場合は、初期化を試みる
      if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
        console.log('音声認識の初期化を再試行します...');
        setIsInitialized(false);
        setTimeout(() => setIsInitialized(true), 500);
      }
      return;
    }
    
    // 処理中なら開始しない
    if (isProcessing) {
      console.log('音声認識を開始できません: 処理中です', { isProcessing });
      return;
    }
    
    // 既に実行中なら一度停止してから開始
    if (isListening || (recognitionRef.current && recognitionRef.current.running)) {
      console.log('音声認識は既に実行中です。一度停止してから再開します。', { 
        isListening, 
        recognitionRunning: recognitionRef.current?.running 
      });
      
      try {
        // 既存の認識を停止
        recognitionRef.current.stop();
        recognitionRef.current.running = false;
        setIsListening(false);
        
        // 少し待ってから再開
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error('実行中の音声認識停止エラー:', error);
        
        // エラーが発生した場合でも状態をリセット
        recognitionRef.current.running = false;
        setIsListening(false);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    console.log('音声認識を開始します...', { isListening, isProcessing });
    setCurrentTranscript(''); // 開始時に前の結果をクリア
    setIsListening(true);
    
    try {
      // マイクへのアクセスを取得
      console.log('マイクアクセスを要求します...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('マイクアクセス許可を取得しました');
      
      // エコーキャンセリングを開始（オーディオ要素があれば）
      if (echoCancellationRef.current && audioRef.current) {
        const audioStream = (audioRef.current as HTMLAudioElement & { captureStream: () => MediaStream }).captureStream();
        await echoCancellationRef.current.start(stream, audioStream);
      }
      
      // 実行中でないことを再確認（非同期処理の間に状態が変わった可能性がある）
      if (recognitionRef.current.running) {
        console.log('マイクアクセス取得後に実行中フラグを検出しました。開始をスキップします。');
        return;
      }
      
      // まずフラグを設定
      recognitionRef.current.running = true;
      
      // 実行中でないことを確認してから開始
      try {
        // 直接開始を試みる
        recognitionRef.current.start();
        console.log('音声認識が開始されました');
      } catch (startError) {
        // 開始に失敗した場合
        console.error('音声認識開始エラー（内部）:', startError);
        
        // 既に開始されている場合は成功として扱う
        if ((startError as Error).message?.includes('already started')) {
          console.log('音声認識は既に開始されています。成功として処理します。');
          recognitionRef.current.running = true;
        } else {
          // その他のエラーはフラグをリセット
          recognitionRef.current.running = false;
          throw startError; // 上位のcatchで処理するために再スロー
        }
      }
      
      // マイクへのアクセス許可を促すメッセージ（初回のみ）
      if (!initRef.current.speechInitialized) {
        console.log('音声認識の初回開始: マイクの許可が必要かもしれません');
        initRef.current.speechInitialized = true;
      }
    } catch (error) {
      console.error('音声認識開始エラー:', error, {
        message: (error as Error).message,
        stack: (error as Error).stack
      });
      
      // 既に開始されている場合は無視
      if ((error as Error).message && (error as Error).message.includes('already started')) {
        console.log('音声認識は既に開始されています');
        recognitionRef.current.running = true;
      } else {
        // その他のエラーは状態をリセット
        recognitionRef.current.running = false;
        setIsListening(false);
        
        // 再試行
        setTimeout(() => {
          if (!isProcessing) {
            console.log('音声認識再試行...');
            startListening();
          }
        }, 1000);
      }
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