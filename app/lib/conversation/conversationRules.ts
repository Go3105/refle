/**
 * 会話のルールを管理するモジュール
 */

import { Message } from '@/app/components/RealtimeConversation';

/**
 * 会話終了の条件をチェックする
 * @param messages 会話履歴
 * @param startTime 会話開始時間
 * @param currentTime 現在時刻
 * @returns 会話を終了すべきかどうか
 */
export const shouldEndConversation = (
    messages: Message[],
    startTime: number | null,
    currentTime: number
): boolean => {
    if (!startTime) return false;

    // 会話開始時間からの経過秒数を計算
    const elapsedSeconds = Math.floor((currentTime - startTime) / 1000);
    
    // 会話開始から60秒以上経過している場合に会話を終了
    return elapsedSeconds >= 60;
};

/**
 * 会話終了時のメッセージを生成する
 * @param userMessage ユーザーの最後のメッセージ
 * @returns 会話終了時のメッセージ
 */
export const createEndConversationMessages = (
    userMessage: string
): Message[] => {
    return [
        {
            role: 'user',
            content: userMessage,
            timestamp: Date.now()
        },
        {
            role: 'assistant',
            content: 'いただいた情報を元にサマリを作成します。少々お待ちください。',
            timestamp: Date.now()
        }
    ];
}; 