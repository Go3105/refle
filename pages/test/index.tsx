import { useState, useEffect } from 'react';
import Head from 'next/head';
import { createInitialConversationHistory, getCurrentPhase, formatElapsedTime, TIME_BASED_PROMPTS } from '@/app/lib/prompts';

type Message = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
};

const formatMessageElapsedTime = (startTime: Date, currentTime: Date): string => {
  const elapsedSeconds = Math.floor((currentTime.getTime() - startTime.getTime()) / 1000);
  return formatElapsedTime(elapsedSeconds);
};

export default function TestPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationStartTime, setConversationStartTime] = useState<Date | null>(null);
  const [currentPhase, setCurrentPhase] = useState<string>('');
  const [summary, setSummary] = useState<string>('');
  const [editableSummary, setEditableSummary] = useState<string>('');
  const [lastMessageTime, setLastMessageTime] = useState<Date | null>(null);
  const [shouldCreateSummary, setShouldCreateSummary] = useState(false);

  useEffect(() => {
    const resetConversation = async () => {
      try {
        console.log('会話をリセット中...');
        const response = await fetch('/api/gemini', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reset: true }),
        });
        const data = await response.json();
        console.log('APIリセット応答:', data);
        
        setMessages([]);
        setConversationStartTime(null);
        setCurrentPhase('');
        console.log('会話がリセットされました');
      } catch (error) {
        console.error('会話のリセット中にエラーが発生しました:', error);
      }
    };

    resetConversation();
  }, []);

  useEffect(() => {
    if (!conversationStartTime) return;

    const updatePhase = () => {
      const currentTime = new Date();
      const elapsedSeconds = Math.floor((currentTime.getTime() - conversationStartTime.getTime()) / 1000);
      const phase = getCurrentPhase(elapsedSeconds);
      setCurrentPhase(phase);

      // CLOSING_STAGEの開始時間に達したらサマリ作成フラグを立てる
      if (elapsedSeconds >= TIME_BASED_PROMPTS.CLOSING_STAGE.duration.start && !shouldCreateSummary) {
        setShouldCreateSummary(true);
      }
    };

    const interval = setInterval(updatePhase, 1000);
    return () => clearInterval(interval);
  }, [conversationStartTime, shouldCreateSummary]);

  const createSummary = async () => {
    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ createSummary: true }),
      });
      const data = await res.json();
      setSummary(data.summary);
      setEditableSummary(data.summary);
    } catch (error) {
      console.error('サマリ作成エラー:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const currentTime = new Date();
    const isFirstMessage = !conversationStartTime;
    
    if (isFirstMessage) {
      setConversationStartTime(currentTime);
    }

    const userMessage: Message = { 
      role: 'user', 
      content: input,
      timestamp: currentTime
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setLastMessageTime(currentTime);

    try {
      const elapsedSeconds = isFirstMessage ? 0 : 
        Math.floor((currentTime.getTime() - conversationStartTime!.getTime()) / 1000);

      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          message: input,
          elapsedSeconds
        }),
      });
      const data = await res.json();
      
      const assistantMessage: Message = { 
        role: 'assistant', 
        content: data.response,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);

      // 送信後にサマリ作成フラグが立っているかチェック
      if (shouldCreateSummary && !summary) {
        createSummary();
      }
    } catch (error) {
      console.error('Error:', error);
      const errorMessage: Message = { 
        role: 'assistant', 
        content: 'エラーが発生しました。もう一度お試しください。',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
    setIsLoading(false);
  };

  const handleReset = async () => {
    try {
      await fetch('/api/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reset: true }),
      });
      setMessages([]);
      setConversationStartTime(null);
      setCurrentPhase('');
    } catch (error) {
      console.error('Error resetting conversation:', error);
    }
  };

  const handleSummaryChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditableSummary(e.target.value);
  };

  const handleSummarySave = () => {
    setSummary(editableSummary);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <Head>
        <title>会話精度検証</title>
      </Head>
      
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex flex-col">
          <div className="p-4 border-b bg-white flex justify-between items-center">
            <h1 className="text-xl font-bold text-gray-900">会話精度検証</h1>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              会話をリセット
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div className={`flex items-start max-w-3xl gap-3 ${
                  message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                }`}>
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200">
                    {message.role === 'assistant' ? (
                      <div className="w-full h-full bg-green-500 flex items-center justify-center">
                        <span className="text-white font-bold">G</span>
                      </div>
                    ) : (
                      <div className="w-full h-full bg-blue-500 flex items-center justify-center">
                        <span className="text-white font-bold">U</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <div
                      className={`p-3 rounded-lg ${
                        message.role === 'user'
                          ? 'bg-blue-500 text-white'
                          : 'bg-white text-gray-800 shadow-sm'
                      }`}
                    >
                      {message.content}
                    </div>
                    {conversationStartTime && (
                      <div className="text-xs text-gray-500 mt-1">
                        開始から {formatMessageElapsedTime(conversationStartTime, message.timestamp)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {summary && (
              <div className="mt-8 p-4 bg-white rounded-lg shadow">
                <h2 className="text-lg font-bold mb-2">会話のサマリ</h2>
                <form className="space-y-3">
                  <textarea 
                    className="w-full p-2 border rounded-md min-h-[150px]"
                    value={editableSummary}
                    onChange={handleSummaryChange}
                  ></textarea>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleSummarySave}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      保存
                    </button>
                  </div>
                </form>
              </div>
            )}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex items-start max-w-3xl gap-3">
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200">
                    <div className="w-full h-full bg-green-500 flex items-center justify-center">
                      <span className="text-white font-bold">G</span>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-white text-gray-800 shadow-sm">
                    考え中...
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 border-t bg-white">
            <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="メッセージを入力..."
                  className="flex-1 p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  送信
                </button>
              </div>
              {currentPhase && (
                <div className="mt-2 text-sm text-gray-500">
                  現在のフェーズ: {currentPhase}
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
} 