/**
 * app/hooks/useBetterSpeechRecognition.ts
 * react-speech-recognitionを使用した拡張音声認識カスタムフック
 * 各会話ターンごとに音声認識を新しく開始する設計
 */
import { useState, useEffect, useRef, useCallback } from 'react';

// 本番用のSpeechRecognitionライブラリのインポート
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';

export interface UseBetterSpeechRecognitionProps {
  onResult: (transcript: string) => void;
  onInterim: (transcript: string) => void;
  langCode?: string;
  continuous?: boolean;
  autoRestart?: boolean;
  restartDelay?: number;
  resultDelay?: number; // 結果を処理するまでの遅延
}

export interface UseBetterSpeechRecognitionReturn {
  listening: boolean;
  isBrowserSupported: boolean;
  transcript: string;
  interimTranscript: string;
  finalTranscript: string;
  resetTranscript: () => void;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
  isProcessing: boolean;
  error: Error | null;
}

export function useBetterSpeechRecognition({
  onResult,
  onInterim,
  langCode = 'ja-JP',
  continuous = false, // デフォルトで継続モードはオフ
  autoRestart = false, // デフォルトで自動再起動はオフ
  restartDelay = 1000,
  resultDelay = 300 // デフォルト300ms
}: UseBetterSpeechRecognitionProps): UseBetterSpeechRecognitionReturn {
  // ベースとなるSpeechRecognitionフックの使用
  const {
    transcript,
    interimTranscript,
    finalTranscript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition
  } = useSpeechRecognition();

  // ブラウザサポートのチェック
  const isBrowserSupported = browserSupportsSpeechRecognition();

  // 追加の状態管理
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorCount, setErrorCount] = useState(0);
  const restartTimerRef = useRef<NodeJS.Timeout | null>(null);
  const processingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastResultRef = useRef('');
  const lastInterimRef = useRef('');
  const isMountedRef = useRef(true);
  const lastProcessTimeRef = useRef(0);
  const [currentInterim, setCurrentInterim] = useState('');
  
  // 認識テキスト履歴の管理（重複防止用）
  const transcriptHistoryRef = useRef<string[]>([]);
  const MAX_HISTORY_LENGTH = 5; // 履歴の最大保持数
  
  // 設定値をRefに保存して循環参照を避ける
  const configRef = useRef({
    continuous,
    autoRestart,
    restartDelay,
    langCode
  });
  
  // 設定値の更新
  useEffect(() => {
    configRef.current = {
      continuous,
      autoRestart,
      restartDelay,
      langCode
    };
  }, [continuous, autoRestart, restartDelay, langCode]);

  // 音声認識の基本操作関数
  const internalResetTranscript = useCallback(() => {
    resetTranscript();
    setCurrentInterim('');
    lastInterimRef.current = '';
  }, [resetTranscript]);
  
  const internalStopListening = useCallback(() => {
    try {
      // すべてのタイマーをクリア
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
      
      if (processingTimerRef.current) {
        clearTimeout(processingTimerRef.current);
        processingTimerRef.current = null;
      }
      
      // 履歴と中間結果をクリア
      lastInterimRef.current = '';
      setCurrentInterim('');
      
      // 音声認識を停止
      SpeechRecognition.stopListening();
      resetTranscript();
      
      console.log('音声認識を停止しました');
    } catch (error) {
      console.error('音声認識停止エラー:', error);
    }
  }, [resetTranscript]);
  
  // 履歴にテキストを追加する関数
  const addToTranscriptHistory = useCallback((text: string) => {
    const normalizedText = text.trim().toLowerCase();
    transcriptHistoryRef.current.push(normalizedText);
    
    // 履歴が長すぎる場合は古いものを削除
    if (transcriptHistoryRef.current.length > MAX_HISTORY_LENGTH) {
      transcriptHistoryRef.current.shift();
    }
  }, []);
  
  // テキストが最近の履歴にあるかチェックする関数
  const isRecentTranscript = useCallback((text: string) => {
    const normalizedText = text.trim().toLowerCase();
    return transcriptHistoryRef.current.includes(normalizedText);
  }, []);
  
  const internalStartListening = useCallback(() => {
    try {
      if (!isBrowserSupported) {
        console.error('このブラウザは音声認識をサポートしていません');
        return;
      }
      
      // 念のため先に停止
      internalStopListening();
      
      // すべての状態をリセット
      resetTranscript();
      setCurrentInterim('');
      // 注意: lastResultRefは保持して重複を防ぐ
      lastInterimRef.current = '';
      
      // 音声認識開始
      SpeechRecognition.startListening({
        continuous: configRef.current.continuous,
        language: configRef.current.langCode
      });
      
      // エラーカウントをリセット
      setErrorCount(0);
      
      console.log(`音声認識を開始しました (${configRef.current.continuous ? '継続' : '単発'}モード)`);
    } catch (error) {
      console.error('音声認識開始エラー:', error);
      setErrorCount(prev => prev + 1);
    }
  }, [isBrowserSupported, resetTranscript, internalStopListening]);
  
  // 関数を外部に公開するためのラッパー
  const stopListening = useCallback(() => {
    internalStopListening();
  }, [internalStopListening]);
  
  const startListening = useCallback(() => {
    internalStartListening();
  }, [internalStartListening]);
  
  const toggleListening = useCallback(() => {
    if (listening) {
      internalStopListening();
    } else {
      internalStartListening();
    }
  }, [listening, internalStartListening, internalStopListening]);

  // 中間結果の処理
  useEffect(() => {
    if (interimTranscript && !isProcessing) {
      // 中間テキストを整形して表示
      const cleanInterim = interimTranscript.trim();
      setCurrentInterim(cleanInterim);
      onInterim(cleanInterim);
      
      if (cleanInterim.length > 0) {
        console.log('中間結果:', cleanInterim);
      }
    }
  }, [interimTranscript, isProcessing, onInterim]);

  // 確定結果の処理 - 単発認識に対応
  useEffect(() => {
    if (finalTranscript && !isProcessing) {
      // 確定結果を取得
      const transcript = finalTranscript.trim();
      
      // 前回と同じ結果やすでに処理済みの結果を防ぐ
      if (transcript.length > 1 && 
          transcript !== lastResultRef.current && 
          !isRecentTranscript(transcript)) {
        
        console.log('確定結果:', transcript);
        
        // 前回の結果を保存
        lastResultRef.current = transcript;
        
        // 履歴に追加
        addToTranscriptHistory(transcript);
        
        // 音声認識を即座に停止
        internalStopListening();
        
        // 結果をコールバックで返す
        onResult(transcript);
        
        // 継続モードがオンで自動再起動がオンの場合、遅延して再開
        if (configRef.current.continuous && configRef.current.autoRestart) {
          restartTimerRef.current = setTimeout(() => {
            if (isMountedRef.current && !isProcessing) {
              internalStartListening();
            }
          }, configRef.current.restartDelay);
        }
      } else if (transcript.length > 1) {
        console.log('重複した結果をスキップ:', transcript);
      }
    }
  }, [finalTranscript, isProcessing, onResult, internalStopListening, internalStartListening, isRecentTranscript, addToTranscriptHistory]);

  // マウント状態の追跡
  useEffect(() => {
    isMountedRef.current = true;
    
    // 履歴をクリア
    transcriptHistoryRef.current = [];
    
    return () => {
      isMountedRef.current = false;
      
      // タイマーをクリア
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
      }
      
      if (processingTimerRef.current) {
        clearTimeout(processingTimerRef.current);
      }
      
      internalStopListening();
    };
  }, [internalStopListening]);

  return {
    listening,
    isBrowserSupported,
    transcript: currentInterim || transcript,
    interimTranscript,
    finalTranscript,
    resetTranscript: internalResetTranscript,
    startListening,
    stopListening,
    toggleListening,
    isProcessing,
    error: null
  };
} 