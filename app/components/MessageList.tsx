import { useRef, useEffect } from 'react';
import Image from 'next/image';
import { Message } from '../lib/hooks/useChat';

interface MessageListProps {
  messages: Message[];
  currentTranscript: string;
  startTime: Date | null;
  messagesEndRef: React.RefObject<HTMLDivElement>;
}

export default function MessageList({ 
  messages, 
  currentTranscript, 
  startTime,
  messagesEndRef 
}: MessageListProps) {
  
  // メッセージが追加されたときに自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, messagesEndRef]);
  
  /**
   * 開始時間からの経過時間を計算して表示形式に変換する
   */
  const formatElapsedTime = (messageTime: Date): string => {
    if (!startTime) return '';
    
    const elapsedSeconds = Math.floor((messageTime.getTime() - startTime.getTime()) / 1000);
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;
    
    return `${minutes}分${seconds}秒`;
  };
  
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* 会話メッセージ */}
      {messages.map((message, index) => (
        <div
          key={index}
          className={`mb-4 ${message.role === 'user'
            ? 'ml-auto bg-pink-100'
            : 'mr-auto bg-white flex items-start'
            } p-3 rounded-lg max-w-[80%]`}
        >
          {/* AIメッセージにはアイコンを表示 */}
          {message.role === 'assistant' && (
            <div className="mr-2 flex-shrink-0">
              <Image
                src="/ai_character.png"
                width={40}
                height={40}
                alt="AI character"
                className="rounded-full"
              />
            </div>
          )}
          <div>
            <p>{message.content}</p>
            {startTime && (
              <p className="text-xs text-gray-500 mt-1">
                {formatElapsedTime(message.timestamp)}
              </p>
            )}
          </div>
        </div>
      ))}
      
      {/* 音声認識中のテキスト */}
      {currentTranscript && (
        <div className="ml-auto bg-gray-100 p-3 rounded-lg max-w-[80%] italic">
          <p>{currentTranscript}</p>
        </div>
      )}
      
      {/* スクロール位置調整用の参照ポイント */}
      <div ref={messagesEndRef} />
    </div>
  );
} 