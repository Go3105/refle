import { useRef, useEffect } from 'react';
import { Bot, User } from 'lucide-react';
import { Message } from '../lib/hooks/useChat';

interface MessageListProps {
  messages: Message[];
  currentTranscript: string;
  startTime: Date | null;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
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
    
    // startTimeからmessageTimeまでの経過時間を秒単位で計算
    const elapsedSeconds = Math.floor((messageTime.getTime() - startTime.getTime()) / 1000);
    
    // 分と秒を計算
    const absSeconds = Math.abs(elapsedSeconds);
    const minutes = Math.floor(absSeconds / 60);
    const seconds = absSeconds % 60;
    
    // 分がある場合は「分秒」、ない場合は「秒」だけ表示
    if (minutes > 0) {
      return `${minutes}分${seconds}秒`;
    } else {
      return `${seconds}秒`;
    }
  };
  
  return (
    <div className="flex-1 overflow-y-auto p-4" style={{ backgroundColor: '#FFFFFF' }}>
      <div className="max-w-3xl mx-auto">
        {/* 会話メッセージ */}
        {messages.map((message, index) => (
          <div key={index} className={`flex ${message.role === 'assistant' ? 'justify-start' : 'justify-end'} mb-4 animate-fadeIn`}>
            <div className={`flex ${message.role === 'assistant' ? 'flex-row' : 'flex-row-reverse'} max-w-[80%]`}>
              <div className={`flex-shrink-0 ${message.role === 'assistant' ? 'mr-3' : 'ml-3'} self-end`}>
                {message.role === 'assistant' ? (
                  <div className="bg-green-100 p-1 rounded-full">
                    <Bot className="h-6 w-6 text-green-600" />
                  </div>
                ) : (
                  <div className="bg-gray-100 p-1 rounded-full">
                    <User className="h-6 w-6 text-gray-600" />
                  </div>
                )}
              </div>
              <div>
                <div 
                  className={`p-3 rounded-2xl ${message.role === 'assistant' 
                    ? 'bg-[#F2FDF5] text-gray-800 rounded-tl-none shadow-sm' 
                    : 'bg-green-500 text-white rounded-tr-none shadow-sm'
                  }`}
                >
                  {message.content}
                </div>
                {startTime && (
                  <div className={`text-xs mt-1 text-gray-500 ${message.role === 'assistant' ? 'text-left' : 'text-right'}`}>
                    {formatElapsedTime(message.timestamp)}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {/* 音声認識中のテキスト */}
        {currentTranscript && (
          <div className="flex justify-end mb-4">
            <div className="flex flex-row-reverse max-w-[80%]">
              <div className="flex-shrink-0 ml-3 self-end">
                <div className="bg-gray-100 p-1 rounded-full">
                  <User className="h-6 w-6 text-gray-600" />
                </div>
              </div>
              <div>
                <div className="p-3 rounded-2xl bg-green-100 text-gray-800 rounded-tr-none shadow-sm opacity-70">
                  {currentTranscript}
                </div>
                <div className="text-xs mt-1 text-right text-gray-500">認識中...</div>
              </div>
            </div>
          </div>
        )}
        
        {/* スクロール位置調整用の参照ポイント */}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
} 