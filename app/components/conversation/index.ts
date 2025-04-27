/**
 * app/components/conversation/index.ts
 * 会話関連コンポーネントの型定義とエクスポート
 */

import ConversationHeader from './ConversationHeader';
import MessageList from './MessageList';
import InputArea from './InputArea';
import SummaryDisplay from './SummaryDisplay';

// 会話メッセージの型定義
export interface Message {
    role: 'user' | 'assistant';  // メッセージの送信者
    content: string;             // メッセージの内容
    timestamp?: number;          // メッセージの送信時間（ミリ秒単位のUNIXタイムスタンプ）
}

// conversation コンポーネントのエクスポート

// 必要に応じて型定義をエクスポート
export interface ConversationHeaderProps {
  onEndSession: () => void;
  isProcessing?: boolean;
  isDisabled?: boolean;
}

export interface MessageListProps {
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp?: number;
  }>;
  messagesEndRef: React.RefObject<HTMLDivElement>;
}

export interface InputAreaProps {
  isListening: boolean;
  isProcessing: boolean;
  currentTranscript: string;
  toggleListening: () => void;
  onSendMessage: (text: string) => void;
  isDisabled?: boolean;
}

export interface SummaryDisplayProps {
  summary: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSave: () => void;
  isEditing?: boolean;
}

// コンポーネントのエクスポート
export { 
    ConversationHeader,
    MessageList,
    InputArea,
    SummaryDisplay
}; 