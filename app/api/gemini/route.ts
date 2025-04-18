export const runtime = "nodejs";

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { createInitialConversationHistory, PromptTemplate } from '@/app/lib/prompts';

// 会話履歴を保持するための変数（本番環境ではデータベース等を使用することを推奨）
let conversationHistory: PromptTemplate[] = createInitialConversationHistory();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

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
    const contents = conversationHistory.map(msg => ({
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