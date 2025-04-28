export const runtime = "nodejs";

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import {
    createInitialConversationHistory,
    createSystemPrompt,
    setSessionStartTime,
    SessionTime,
    SUMMARY_PROMPT
} from '@/app/lib/prompts';

// APIキーのチェック
if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set in environment variables');
}

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

interface ConversationMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

// セッション管理用のクラス
class SessionManager {
    private static instance: SessionManager;
    private sessionTime: SessionTime | null = null;
    private conversationHistory: ConversationMessage[] = [];

    private constructor() { }

    public static getInstance(): SessionManager {
        if (!SessionManager.instance) {
            SessionManager.instance = new SessionManager();
        }
        return SessionManager.instance;
    }

    public getSessionTime(): SessionTime | null {
        return this.sessionTime;
    }

    public getConversationHistory(): ConversationMessage[] {
        return this.conversationHistory;
    }

    public resetSession(): void {
        this.sessionTime = setSessionStartTime();
        this.conversationHistory = createInitialConversationHistory(this.sessionTime);
    }

    public initializeSession(): void {
        if (!this.sessionTime) {
            this.sessionTime = setSessionStartTime();
            this.conversationHistory = createInitialConversationHistory(this.sessionTime);
        }
    }

    public updateSystemPrompt(elapsedSeconds: number): void {
        if (this.sessionTime) {
            const systemPrompt = createSystemPrompt(elapsedSeconds, this.sessionTime.startTime);
            this.conversationHistory[0] = systemPrompt;
        }
    }

    public addMessage(role: 'user' | 'assistant', content: string): void {
        this.conversationHistory.push({ role, content });
    }
}

interface FetchOptions {
    method: string;
    headers: Record<string, string>;
    body: string;
}

interface GeminiResponse {
    candidates: Array<{
        content: {
            parts: Array<{
                text: string;
            }>;
        };
    }>;
}

export async function POST(request: NextRequest) {
    try {
        const sessionManager = SessionManager.getInstance();

        // リクエストボディのパース
        let body;
        try {
            body = await request.json();
        } catch (error) {
            return NextResponse.json(
                { error: 'Invalid JSON in request body' },
                { status: 400 }
            );
        }

        const { message, reset, elapsedSeconds, createSummary, messages } = body;

        // サマリ作成リクエストの場合
        if (createSummary) {
            // フロントエンドからmessagesが提供された場合はそれを使用
            let conversationData;

            console.log('サマリ作成リクエスト受信:', {
                hasMessages: !!messages,
                messagesLength: messages ? messages.length : 0
            });

            if (messages && Array.isArray(messages) && messages.length > 0) {
                // フロントエンドから提供されたメッセージをGemini用に変換
                // Messageインターフェースの形式から、Geminiが期待する形式に変換
                console.log('フロントエンドから提供されたメッセージを処理します');

                try {
                    const formattedMessages = messages.map(msg => ({
                        role: msg.role === 'assistant' ? 'assistant' : 'user',
                        content: msg.content
                    }));
                    conversationData = JSON.stringify(formattedMessages, null, 2);
                    console.log(`${messages.length}件のメッセージを変換しました`);
                } catch (error) {
                    console.error('メッセージ変換エラー:', error);
                    conversationData = JSON.stringify(messages, null, 2);
                }
            } else {
                // セッションマネージャーから会話履歴を取得
                console.log('セッションマネージャーから会話履歴を取得します');
                const conversationHistory = sessionManager.getConversationHistory();
                conversationData = JSON.stringify(conversationHistory, null, 2);
                console.log(`セッションから${conversationHistory.length}件のメッセージを取得しました`);
            }

            // 会話データが空でないことを確認
            if (!conversationData || conversationData === '[]' || conversationData === '{}') {
                console.warn('会話データが空です。デフォルトのメッセージを返します。');
                return NextResponse.json({
                    summary: '申し訳ありませんが、会話履歴が提供されていません。そのため、サマリを作成することができません。'
                });
            }

            console.log('サマリ作成プロンプトを準備しています');
            const summaryPrompt = SUMMARY_PROMPT.content.replace('{conversationHistory}', conversationData);

            try {
                console.log('Gemini APIにリクエストを送信します');
                const model = 'gemini-2.0-flash-lite';
                const response = await ai.models.generateContentStream({
                    model,
                    contents: [{ role: 'user', parts: [{ text: summaryPrompt }] }]
                });

                let fullResponse = '';
                for await (const chunk of response) {
                    fullResponse += chunk.text;
                }

                console.log('サマリ生成完了:', fullResponse.substring(0, 100) + '...');
                return NextResponse.json({ summary: fullResponse });
            } catch (error) {
                console.error('Gemini APIエラー:', error);
                return NextResponse.json({
                    summary: 'サマリの生成中にエラーが発生しました。申し訳ありませんが、再度お試しください。',
                    error: error.message
                }, { status: 500 });
            }
        }

        if (reset) {
            sessionManager.resetSession();
            console.log('会話履歴をリセットしました');
            return NextResponse.json({
                success: true,
                message: '会話履歴をリセットしました'
            });
        }

        // 初回のメッセージの場合、セッションを開始
        sessionManager.initializeSession();

        if (!message) {
            return NextResponse.json(
                { error: 'Message is required' },
                { status: 400 }
            );
        }

        // 経過時間に応じてシステムプロンプトを更新
        if (elapsedSeconds !== undefined) {
            sessionManager.updateSystemPrompt(elapsedSeconds);
        }

        // ユーザーのメッセージを履歴に追加
        sessionManager.addMessage('user', message);
        console.log('ユーザー:', message);

        const config = {
            responseMimeType: 'text/plain',
            temperature: 0.7,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 800,
            stopSequences: [],
        };

        const model = 'gemini-2.0-flash-lite';

        // 会話履歴をGeminiの形式に変換
        const contents = sessionManager.getConversationHistory().map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        }));

        const response = await ai.models.generateContentStream({
            model,
            config,
            contents,
        });

        let fullResponse = '';
        for await (const chunk of response) {
            fullResponse += chunk.text;
        }

        // AIの応答を履歴に追加
        sessionManager.addMessage('assistant', fullResponse);
        console.log('AI:', fullResponse);
        console.log('--- 会話履歴 ---');
        sessionManager.getConversationHistory().forEach((msg, index) => {
            console.log(`${index + 1}. ${msg.role}: ${msg.content}`);
        });
        console.log('---------------');

        return NextResponse.json({
            success: true,
            response: fullResponse,
            history: sessionManager.getConversationHistory()
        });
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error.message || 'Internal server error',
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined
            },
            { status: 500 }
        );
    }
} 