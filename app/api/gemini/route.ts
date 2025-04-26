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

// セッション管理用のクラス
class SessionManager {
    private static instance: SessionManager;
    private sessionTime: SessionTime | null = null;
    private conversationHistory: any[] = [];

    private constructor() {}

    public static getInstance(): SessionManager {
        if (!SessionManager.instance) {
            SessionManager.instance = new SessionManager();
        }
        return SessionManager.instance;
    }

    public getSessionTime(): SessionTime | null {
        return this.sessionTime;
    }

    public getConversationHistory(): any[] {
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

        const { message, reset, elapsedSeconds, createSummary } = body;

        // サマリ作成リクエストの場合
        if (createSummary) {
            const conversationHistory = sessionManager.getConversationHistory();
            const summaryPrompt = SUMMARY_PROMPT.content.replace('{conversationHistory}', 
                JSON.stringify(conversationHistory, null, 2));

            const model = 'gemini-2.0-flash-lite';
            const response = await ai.models.generateContentStream({
                model,
                contents: [{ role: 'user', parts: [{ text: summaryPrompt }] }]
            });

            let fullResponse = '';
            for await (const chunk of response) {
                fullResponse += chunk.text;
            }

            return NextResponse.json({ summary: fullResponse });
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