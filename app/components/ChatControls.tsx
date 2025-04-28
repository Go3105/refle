import { useRef } from 'react';
import { MicrophoneIcon, StopIcon } from '@heroicons/react/24/solid';

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
        
        {/* セッション終了ボタン */}
        <button
          onClick={onEndSession}
          className="px-6 py-2.5 bg-green-500 text-white rounded-full hover:bg-green-600 transition-all"
        >
          会話を終了してサマリを作成
        </button>
        
        {/* 状態メッセージ */}
        <div className="mt-2 text-xs text-gray-500 text-center">
          {isDisabled ? 
            "AIが応答を考えています..." :
            isListening ?
              "マイクがオンです。お話しください" :
              "マイクボタンを押して会話を始めてください"
          }
        </div>
      </div>
    </div>
  );
} 