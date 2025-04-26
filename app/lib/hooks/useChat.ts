import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { TIME_BASED_PROMPTS, getCurrentPhase } from '../prompts';

// メッセージの型定義
export type Message = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
};

export default function useChat() {
  // チャットの状態
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [currentPhase, setCurrentPhase] = useState('');
  const [summary, setSummary] = useState('');
  const [editableSummary, setEditableSummary] = useState('');
  const [showingSummary, setShowingSummary] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  
  // Socket.IO参照
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  
  // コンポーネントのマウント状態を追跡
  const isMountedRef = useRef(true);
  
  // Socket.IO接続初期化
  useEffect(() => {
    // マウント状態変数
    let isMounted = true;
    isMountedRef.current = true;
    
    // Socket.IO初期化
    const initSocket = async () => {
      try {
        console.log('Socket.IO接続を初期化中...');
        
        // Socket.IOクライアントを初期化
        const socketIo = io({
          path: '/api/socketio',
        });
        
        // socketRefに保存
        socketRef.current = socketIo;
        
        // 接続イベント
        socketIo.on('connect', () => {
          console.log('Socket.IO接続成功:', socketIo.id);
          if (isMounted) setIsConnected(true);
        });
        
        // AIの応答受信イベント
        socketIo.on('ai-response', (data) => {
          console.log('AI応答受信:', data);
          if (isMounted) {
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: data.text,
              timestamp: new Date()
            }]);
            setIsProcessing(false);
          }
        });
        
        // 音声合成リクエストイベント
        socketIo.on('speech-request', async (data) => {
          console.log('音声合成リクエスト:', data);
          // 音声合成はuseSpeechで処理するため、ここではイベントのみ処理
        });
        
        // エラーイベント
        socketIo.on('error', (error) => {
          console.error('Socket.IOエラー:', error);
          if (isMounted) setIsProcessing(false);
        });
        
        // 切断イベント
        socketIo.on('disconnect', () => {
          console.log('Socket.IO切断');
          if (isMounted) setIsConnected(false);
        });
        
      } catch (error) {
        console.error('Socket.IO初期化エラー:', error);
        if (isMounted) setIsConnected(false);
      }
    };
    
    // Socket.IO初期化実行
    initSocket();
    
    // クリーンアップ関数
    return () => {
      isMounted = false;
      isMountedRef.current = false;
      if (socketRef.current) {
        console.log('Socket.IO切断（クリーンアップ）');
        socketRef.current.disconnect();
      }
    };
  }, []);
  
  // 会話時間の監視
  useEffect(() => {
    if (!startTime) return;
    
    // 時間に基づいてフェーズを更新
    const updatePhase = () => {
      const currentTime = new Date();
      const elapsedSeconds = Math.floor((currentTime.getTime() - startTime.getTime()) / 1000);
      const phase = getCurrentPhase(elapsedSeconds);
      setCurrentPhase(phase);
    };
    
    // 1秒ごとにフェーズを更新
    const interval = setInterval(updatePhase, 1000);
    
    // 初回実行
    updatePhase();
    
    return () => clearInterval(interval);
  }, [startTime]);
  
  // 新しいメッセージが追加されたらスクロールを一番下に移動
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  /**
   * メッセージを送信する関数
   * @param text 送信するテキスト
   */
  const sendMessage = (text: string) => {
    // テキストが空なら何もしない
    if (!text.trim()) return;
    
    const currentTime = new Date();
    
    // 初回メッセージなら開始時間を設定
    if (!startTime) {
      setStartTime(currentTime);
    }
    
    // ユーザーメッセージを表示
    setMessages(prev => [...prev, {
      role: 'user',
      content: text,
      timestamp: currentTime
    }]);
    
    // 処理中フラグを設定
    setIsProcessing(true);
    
    // Socket.IOを通じてサーバーに送信
    if (socketRef.current) {
      console.log('ユーザーメッセージ送信:', text);
      socketRef.current.emit('user-speech', text);
    }
    
    return currentTime;
  };
  
  /**
   * サマリを生成する関数
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
      
      // Socket.IO接続を切断（サマリ生成後に切断）
      setTimeout(() => {
        if (socketRef.current) {
          socketRef.current.disconnect();
        }
        setIsConnected(false);
      }, 1000);
      
    } catch (error) {
      console.error('サマリ作成エラー:', error);
      setIsProcessing(false);
    }
  };
  
  /**
   * サマリを保存する関数
   */
  const saveSummary = () => {
    setSummary(editableSummary);
  };
  
  /**
   * 会話をリセットする関数
   */
  const resetConversation = async () => {
    try {
      await fetch('/api/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reset: true }),
      });
      
      // 状態をリセット
      setMessages([]);
      setStartTime(null);
      setCurrentPhase('');
      setSummary('');
      setEditableSummary('');
      setShowingSummary(false);
      
      // 新しいSocket.IO接続を初期化
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      
      // 再接続はuseEffectで自動的に行われる
      
    } catch (error) {
      console.error('会話のリセット中にエラーが発生しました:', error);
    }
  };
  
  return {
    // 状態
    messages,
    isProcessing,
    startTime,
    currentPhase,
    summary,
    editableSummary,
    showingSummary,
    isConnected,
    messagesEndRef,
    
    // アクション
    sendMessage,
    createSummary,
    setEditableSummary,
    saveSummary,
    resetConversation,
    setShowingSummary,
  };
} 