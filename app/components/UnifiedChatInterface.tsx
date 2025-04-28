import { useState, useEffect, useRef } from 'react';
import MessageList from './MessageList';
import ChatControls from './ChatControls';
import Summary from './Summary';
import useChat from '../lib/hooks/useChat';
import useSpeech from '../lib/hooks/useSpeech';
import { useConversation } from '../context/ConversationContext';
import useConversationPhase from '../hooks/useConversationPhase';

/**
 * 経過時間をフォーマットする関数
 */
const formatElapsedTime = (startTime: Date | null): string => {
  if (!startTime) return '00:00';
  
  const now = new Date();
  const elapsedSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);
  
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

export default function UnifiedChatInterface() {
  // 音声再生用のオーディオ要素
  const audioElementRef = useRef<HTMLAudioElement>(null);
  
  // 経過時間の状態管理
  const [elapsedTime, setElapsedTime] = useState<string>('00:00');
  
  // 会話コンテキストから開始時間を取得
  const { conversationStartTime, resetConversation } = useConversation();
  
  // チャット機能のフック
  const {
    messages,
    isProcessing,
    sendMessage,
    createSummary,
    summary,
    editableSummary,
    setEditableSummary,
    saveSummary,
    startTime: chatStartTime,
    currentPhase, // この値は引き続き使用されるが、新しいフックからのデータも併用
    showingSummary,
    messagesEndRef,
  } = useChat();
  
  // コンテキストの開始時間を優先、なければチャットの開始時間を使用
  const effectiveStartTime = conversationStartTime || chatStartTime;
  
  // 音声機能のフック
  const {
    isListening,
    currentTranscript,
    toggleListening,
    audioRef,
  } = useSpeech({ 
    onMessageReady: sendMessage,
  });

  // 新しい会話フェーズ管理フックを使用
  const {
    currentPhase: phaseConfig,
    currentPhaseName,
    formattedRemainingTime,
    isRequiringSummary,
    phaseBehavior,
  } = useConversationPhase({
    startTime: effectiveStartTime,
    onPhaseChange: (newPhase, oldPhase) => {
      console.log(`フェーズが変更されました: ${oldPhase?.name || 'なし'} → ${newPhase.name}`);
      
      // フェーズ切り替え時の特別な挙動をここに実装
      if (newPhase.behavior?.showVisualHint) {
        // 例: フェーズ切り替え時のビジュアル通知
        showPhaseChangeNotification(newPhase.name);
      }
      
      // サマリーが必要なフェーズに入ったら自動的にサマリー作成を開始
      if (newPhase.behavior?.requireSummary && !showingSummary) {
        handleEndSession();
      }
    }
  });

  // フェーズ変更通知を表示する関数
  const [phaseNotification, setPhaseNotification] = useState<string | null>(null);
  
  const showPhaseChangeNotification = (phaseName: string) => {
    setPhaseNotification(`フェーズが切り替わりました: ${phaseName}`);
    
    // 3秒後に通知を消す
    setTimeout(() => {
      setPhaseNotification(null);
    }, 3000);
  };
  
  // オーディオ要素の参照を設定
  useEffect(() => {
    if (audioElementRef.current) {
      audioRef.current = audioElementRef.current;
    }
  }, [audioRef]);
  
  // タイマーの更新
  useEffect(() => {
    if (!effectiveStartTime) return;
    
    // 1秒ごとに経過時間を更新
    const interval = setInterval(() => {
      setElapsedTime(formatElapsedTime(effectiveStartTime));
    }, 1000);
    
    // 初回の更新
    setElapsedTime(formatElapsedTime(effectiveStartTime));
    
    return () => clearInterval(interval);
  }, [effectiveStartTime]);
  
  // サマリー表示時に会話状態をリセット
  useEffect(() => {
    if (showingSummary) {
      resetConversation();
    }
  }, [showingSummary, resetConversation]);
  
  // サマリー作成時の処理をラップして会話状態のリセットを追加
  const handleEndSession = () => {
    createSummary();
  };

  // UI部分の更新 - フェーズ情報と残り時間の表示を追加
  return (
    <div className="flex flex-col h-full">
      {/* フェーズ通知 */}
      {phaseNotification && (
        <div className="bg-blue-500 text-white p-2 text-center animate-fade-in-out">
          {phaseNotification}
        </div>
      )}
      
      {/* フェーズと残り時間の表示 */}
      <div className="flex justify-between items-center bg-gray-100 p-2 border-b">
        <div className="text-sm font-medium">
          現在のフェーズ: <span className="text-blue-600">{currentPhaseName}</span>
        </div>
        <div className="text-sm">
          残り時間: <span className="font-mono">{formattedRemainingTime}</span>
        </div>
      </div>
      
      {/* メッセージリスト */}
      <div className="flex-grow overflow-y-auto">
        {showingSummary ? (
          <Summary 
            summary={summary}
            onChange={setEditableSummary}
            onSave={saveSummary}
          />
        ) : (
          <MessageList 
            messages={messages}
            currentTranscript={currentTranscript}
            startTime={effectiveStartTime}
            messagesEndRef={messagesEndRef}
          />
        )}
      </div>
      
      {/* チャットコントロール */}
      <div className="border-t border-gray-200">
        <ChatControls 
          isListening={isListening} 
          isProcessing={isProcessing}
          onToggleListening={toggleListening}
          currentTranscript={currentTranscript}
          onSendMessage={sendMessage}
          onEndSession={handleEndSession}
        />
      </div>
      
      {/* オーディオプレイヤー（非表示） */}
      <audio ref={audioElementRef} className="hidden" />
    </div>
  );
} 