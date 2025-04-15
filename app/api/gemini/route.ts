import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const { messages } = await request.json();
        console.log('[gemini-api] リクエスト受信:', {
            messagesCount: messages.length,
            lastUserMessage: messages.filter(m => m.role === 'user').pop()?.content
        });

        // APIキーは環境変数から取得
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error('[gemini-api] APIキーが設定されていません');
            return NextResponse.json({
                error: 'APIキーが設定されていません。.env.localファイルにGEMINI_API_KEYを設定してください。'
            }, { status: 500 });
        }

        // Gemini 2.0 Flash API用のリクエスト形式に変換
        const geminiMessages = messages.map(msg => {
            if (msg.role === 'system') {
                return { role: 'user', parts: [{ text: msg.content }] };
            } else if (msg.role === 'assistant') {
                return { role: 'model', parts: [{ text: msg.content }] };
            } else {
                return { role: 'user', parts: [{ text: msg.content }] };
            }
        });

        console.log('[gemini-api] Gemini APIリクエスト送信中...');

        // Gemini API呼び出し
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: geminiMessages,
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 800,
                        topP: 0.95,
                        topK: 40
                    }
                })
            }
        );

        if (!response.ok) {
            const errorData = await response.text();
            console.error(`[gemini-api] APIエラー: ${response.status}`, errorData);
            return NextResponse.json({
                error: `Gemini APIエラー: ${response.status} ${response.statusText}`,
                details: errorData
            }, { status: response.status });
        }

        const data = await response.json();

        if (!data.candidates || data.candidates.length === 0) {
            console.error('[gemini-api] 応答が空です');
            return NextResponse.json({ error: 'Gemini APIからの応答が空です' }, { status: 500 });
        }

        const responseText = data.candidates[0].content.parts[0].text;
        console.log('[gemini-api] 応答:', responseText.substring(0, 100) + '...');

        return NextResponse.json({ text: responseText });
    } catch (error) {
        console.error('[gemini-api] エラー:', error);
        return NextResponse.json({
            error: `Gemini API呼び出しエラー: ${error.message || '不明なエラー'}`
        }, { status: 500 });
    }
} 