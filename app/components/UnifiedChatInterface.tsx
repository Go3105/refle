import { useState, useEffect, useRef } from 'react';
import MessageList from './MessageList';
import ChatControls from './ChatControls';
import Summary from './Summary';
import useChat from '../lib/hooks/useChat';
import useSpeech from '../lib/hooks/useSpeech';

export default function UnifiedChatInterface() {
  // 音声再生用のオーディオ要素
  const audioElementRef = useRef<HTMLAudioElement>(null);
  
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
    startTime,
    currentPhase,
    showingSummary,
    messagesEndRef,
    socketRef,
  } = useChat();
  
  // 音声機能のフック
  const {
    isListening,
    currentTranscript,
    toggleListening,
    audioRef,
  } = useSpeech({ 
    onMessageReady: sendMessage,
    socketRef: socketRef
  });
  
  // オーディオ要素の参照を設定
  useEffect(() => {
    if (audioElementRef.current) {
      audioRef.current = audioElementRef.current;
    }
  }, [audioRef]);
  
  return (
    <div className="flex flex-col h-full">
      {/* オーディオ要素（非表示） */}
      <audio ref={audioElementRef} className="hidden" />
      
      {/* サマリが表示されている場合 */}
      {showingSummary ? (
        <Summary
          summary={editableSummary}
          onChange={setEditableSummary}
          onSave={saveSummary}
        />
      ) : (
        <>
          {/* メッセージリスト */}
          <MessageList 
            messages={messages} 
            currentTranscript={currentTranscript}
            startTime={startTime}
            messagesEndRef={messagesEndRef}
          />
          
          {/* チャットコントロール */}
          <ChatControls
            isProcessing={isProcessing}
            isListening={isListening}
            onToggleListening={toggleListening}
            onSendMessage={sendMessage}
            onEndSession={createSummary}
            currentTranscript={currentTranscript}
          />
        </>
      )}
    </div>
  );
} 