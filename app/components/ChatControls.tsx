import { useRef, useState, useEffect } from 'react';
import { MicrophoneIcon, StopIcon, ClockIcon } from '@heroicons/react/24/solid';
import { useConversation } from '../context/ConversationContext';

interface ChatControlsProps {
  isListening: boolean;
  isProcessing: boolean;
  currentTranscript: string;
  onToggleListening: () => void;
  onSendMessage: (text: string) => void;
  onEndSession: () => void;
}

export default function ChatControls({
  isListening,
  isProcessing,
  currentTranscript,
  onToggleListening,
  onSendMessage,
  onEndSession
}: ChatControlsProps) {
  // 処理中はボタンを無効化
  const isDisabled = isProcessing;
  
  // 会話コンテキストから開始時間を取得
  const { conversationStartTime } = useConversation();
  
  // 経過時間の状態管理
  const [elapsedTime, setElapsedTime] = useState('00:00');
  
  // 会話全体の経過時間を計算・更新する
  useEffect(() => {
    if (!conversationStartTime) return;
    
    const updateTime = () => {
      const now = new Date();
      const elapsedSeconds = Math.floor((now.getTime() - conversationStartTime.getTime()) / 1000);
      
      const minutes = Math.floor(elapsedSeconds / 60);
      const seconds = elapsedSeconds % 60;
      
      setElapsedTime(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
    };
    
    // 初回実行
    updateTime();
    
    // 1秒ごとに更新
    const interval = setInterval(updateTime, 1000);
    
    return () => clearInterval(interval);
  }, [conversationStartTime]);
  
  return (
    <div className="p-4 border-t" style={{ backgroundColor: '#F2FDF5' }}>
      <div className="max-w-4xl mx-auto flex flex-col items-center">
        {/* 音声認識中のテキスト表示 */}
        {currentTranscript && (
          <div className="w-full mb-4 p-3 border border-gray-300 rounded-full bg-green-50 text-center">
            {currentTranscript}
          </div>
        )}
        
        {/* マイクボタン */}
        <button
          type="button"
          onClick={onToggleListening}
          disabled={isDisabled}
          className={`p-5 rounded-full ${
            isListening
              ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
              : 'bg-green-500 hover:bg-green-600 text-white'
          } transition-all mb-4`}
          title={isListening ? '音声入力を停止' : '音声入力を開始'}
        >
          {isListening ? (
            <StopIcon className="w-8 h-8" />
          ) : (
            <MicrophoneIcon className="w-8 h-8" />
          )}
        </button>
        
        {/* セッション終了ボタンと経過時間 */}
        <div className="flex items-center space-x-3">
          <button
            onClick={onEndSession}
            className="px-6 py-2.5 bg-green-500 text-white rounded-full hover:bg-green-600 transition-all"
          >
            会話を終了してサマリを作成
          </button>
          
          {/* 経過時間表示 */}
          {conversationStartTime && (
            <div className="py-2 px-4 bg-green-100 rounded-full border border-green-300 shadow-sm flex items-center">
              <ClockIcon className="h-5 w-5 text-green-600 mr-1.5" />
              <span className="text-base font-medium text-green-800">{elapsedTime}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 