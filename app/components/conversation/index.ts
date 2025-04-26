/**
 * app/components/conversation/index.ts
 * 会話関連コンポーネントの型定義とエクスポート
 */

import ConversationHeader from './ConversationHeader';

// 会話メッセージの型定義
export interface Message {
    role: 'user' | 'assistant';  // メッセージの送信者
    content: string;             // メッセージの内容
    timestamp?: number;          // メッセージの送信時間（ミリ秒単位のUNIXタイムスタンプ）
}

// コンポーネントのエクスポート
export { 
    ConversationHeader
}; 