export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { createInitialConversationHistory, PromptTemplate } from '@/app/lib/prompts';

// 会話履歴を保持するための変数（本番環境ではデータベース等を使用することを推奨）
let conversationHistory: PromptTemplate[] = createInitialConversationHistory();

export async function POST(request: NextRequest) {
    try {
        const { message, reset } = await request.json();

        if (reset) {
            conversationHistory = createInitialConversationHistory();
            console.log('会話履歴をリセットしました');
            return NextResponse.json({ success: true, message: '会話履歴をリセットしました' });
        }

        if (!message) {
            return NextResponse.json(
                { error: 'Message is required' },
                { status: 400 }
            );
        }

        // ユーザーのメッセージを履歴に追加
        conversationHistory.push({ role: 'user', content: message });
        console.log('ユーザー:', message);

        const apiKey = process.env.GEMINI_API_KEY;
        const model = 'gemini-2.0-flash-lite';

        // Gemini API用のリクエストデータを作成
        const contents = conversationHistory.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        }));

        const body = {
            contents,
            generationConfig: {
                temperature: 0.7,
                topP: 0.95,
                topK: 40,
                maxOutputTokens: 800,
                stopSequences: [],
            }
        };

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            return NextResponse.json({ error: errorText }, { status: response.status });
        }

        const data = await response.json();
        const fullResponse = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

        // AIの応答を履歴に追加
        conversationHistory.push({ role: 'assistant', content: fullResponse });
        console.log('AI:', fullResponse);
        console.log('--- 会話履歴 ---');
        conversationHistory.forEach((msg, index) => {
            console.log(`${index + 1}. ${msg.role}: ${msg.content}`);
        });
        console.log('---------------');

        return NextResponse.json({
            response: fullResponse,
            history: conversationHistory
        });
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
} 