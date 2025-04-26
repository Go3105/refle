import { useState, useRef, useEffect } from 'react';
import { MicrophoneIcon, PaperAirplaneIcon, StopIcon } from '@heroicons/react/24/solid';

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
  const [textInput, setTextInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  
  // テキスト入力変更ハンドラー
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTextInput(e.target.value);
  };
  
  // テキスト入力送信ハンドラー
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // 入力が空なら何もしない
    if (!textInput.trim()) return;
    
    // メッセージを送信
    onSendMessage(textInput);
    
    // 入力をクリア
    setTextInput('');
    
    // 入力フィールドにフォーカスを戻す
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };
  
  // 処理中はボタンを無効化
  const isDisabled = isProcessing;
  
  return (
    <div className="p-4 border-t bg-white">
      <div className="max-w-4xl mx-auto">
        {/* テキスト入力フォーム */}
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={textInput}
            onChange={handleInputChange}
            placeholder="メッセージを入力..."
            className="flex-1 p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-300"
            disabled={isDisabled}
          />
          
          {/* 音声入力トグルボタン */}
          <button
            type="button"
            onClick={onToggleListening}
            disabled={isDisabled}
            className={`p-3 rounded-full ${
              isListening
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-pink-100 hover:bg-pink-200'
            } transition-colors`}
            title={isListening ? '音声入力を停止' : '音声入力を開始'}
          >
            {isListening ? (
              <StopIcon className="w-6 h-6 text-white" />
            ) : (
              <MicrophoneIcon className="w-6 h-6 text-pink-500" />
            )}
          </button>
          
          {/* テキスト送信ボタン */}
          <button
            type="submit"
            disabled={isDisabled || !textInput.trim()}
            className="p-3 bg-pink-500 text-white rounded-full hover:bg-pink-600 transition-colors disabled:opacity-50"
            title="メッセージを送信"
          >
            <PaperAirplaneIcon className="w-6 h-6" />
          </button>
        </form>
        
        {/* 現在の音声認識結果 */}
        {currentTranscript && (
          <div className="mt-2 text-sm text-gray-500 italic">
            {currentTranscript}
          </div>
        )}
        
        {/* セッション終了ボタン */}
        <div className="mt-4 flex justify-center">
          <button
            onClick={onEndSession}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            会話を終了してサマリを作成
          </button>
        </div>
      </div>
    </div>
  );
} 