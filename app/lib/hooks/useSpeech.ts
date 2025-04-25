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
  
  // 初期化状態の追跡
  const initRef = useRef({
    speechInitialized: false
  });

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
          
          // 音声認識が停止していれば再開
          if (recognitionRef.current && !recognitionRef.current.running && !isProcessing) {
            startListening();
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
      recognition.continuous = true;      // 継続的に認識
      recognition.interimResults = true;  // 中間結果も取得
      recognition.lang = 'ja-JP';         // 日本語で認識
      
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
        setCurrentTranscript(transcript);
        
        // 確定結果がある場合はメッセージを送信
        if (isFinal && transcript.trim() && !isProcessing) {
          handleSendMessage(transcript);
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
        
        // もし音声認識が明示的に停止されていなければ再開を試みる
        if (recognition.running) {
          console.log('音声認識は継続中のため再開を試みます');
          
          // 少し遅延させてから再開（処理中でなければ）
          setTimeout(() => {
            if (recognition.running && !isProcessing) {
              try {
                recognition.start();
                console.log('音声認識が再開されました');
              } catch (error) {
                console.error('音声認識の自動再開に失敗:', error);
                
                // 既に開始しているエラーは無視
                if ((error as Error).message?.includes('already started')) {
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
      
      // 音声検出開始イベント
      recognition.onspeechstart = () => {
        console.log('音声入力開始を検出しました');
      };
      
      // 音声検出終了イベント
      recognition.onspeechend = () => {
        console.log('音声入力の区切りを検出しました');
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
  
  // コンポーネント初期化
  useEffect(() => {
    // 一度だけ初期化フラグを設定
    if (!isInitialized) {
      console.log('音声認識の初期化を開始します...');
      setIsInitialized(true);
    }
    
    // クリーンアップ関数
    return () => {
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
    };
  }, []);
  
  /**
   * 音声認識を開始する関数
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
      
      // エコーキャンセリングを開始（オーディオ要素があれば）
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
      if ((error as Error).message && (error as Error).message.includes('already started')) {
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
   * 音声認識の開始/停止を切り替える関数
   */
  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };
  
  /**
   * 音声認識されたテキストを送信する関数
   */
  const handleSendMessage = (text: string) => {
    // 音声認識を一時停止
    if (recognitionRef.current && (isListening || recognitionRef.current.running)) {
      console.log('メッセージ送信中は音声認識を停止します');
      setIsListening(false);
      try {
        recognitionRef.current.running = false;
        recognitionRef.current.stop();
      } catch (error) {
        console.error('音声認識停止エラー:', error);
      }
    }
    
    // リセット
    setCurrentTranscript('');
    setIsProcessing(true);
    
    // メッセージ送信コールバックを呼び出す
    onMessageReady(text);
  };
  
  return {
    // 状態
    isListening,
    isProcessing,
    currentTranscript,
    audioRef,
    
    // アクション
    startListening,
    stopListening,
    toggleListening,
  };
} 