import { NextResponse } from 'next/server';

export async function GET() {
    try {
        // 環境変数の確認
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({
                success: false,
                error: 'GEMINI_API_KEYが設定されていません。.env.localファイルで設定してください。'
            }, { status: 500 });
        }

        // シンプルなテストメッセージを送信
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        role: 'user',
                        parts: [{ text: '日本語で「こんにちは、元気ですか？」と返してください。' }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 100
                    }
                })
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            return NextResponse.json({
                success: false,
                status: response.status,
                error: `Gemini APIエラー: ${response.statusText}`,
                details: errorText
            }, { status: response.status });
        }

        const data = await response.json();
        const text = data.candidates[0].content.parts[0].text;

        return NextResponse.json({
            success: true,
            response: text,
            message: 'Gemini APIは正常に動作しています。',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: `Gemini APIテストエラー: ${error.message || '不明なエラー'}`
        }, { status: 500 });
    }
} 