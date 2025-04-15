import { NextResponse } from 'next/server';

export async function GET() {
    try {
        // 環境変数の状態を安全に確認するためのエンドポイント
        // 注意: 本番環境では必要に応じてアクセス制限を設けること

        const envStatus = {
            ELEVEN_LABS_API_KEY: process.env.ELEVEN_LABS_API_KEY ? 'セット済み' : '未設定',
            GEMINI_API_KEY: process.env.GEMINI_API_KEY ? 'セット済み' : '未設定',
            NODE_ENV: process.env.NODE_ENV,
            // 他に確認したい環境変数があればここに追加
        };

        console.log('環境変数チェック:', envStatus);

        // Gemini APIが実際に機能するかテストする
        let geminiTestResult = { success: false, message: '未テスト' };

        if (process.env.GEMINI_API_KEY) {
            try {
                const apiKey = process.env.GEMINI_API_KEY;

                // テストリクエスト
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
                                parts: [{ text: 'テスト: 1 + 1 = ?' }]
                            }],
                            generationConfig: {
                                temperature: 0.1,
                                maxOutputTokens: 10
                            }
                        })
                    }
                );

                if (response.ok) {
                    const data = await response.json();
                    if (data.candidates && data.candidates.length > 0) {
                        const text = data.candidates[0].content.parts[0].text;
                        geminiTestResult = { success: true, message: `応答: ${text.substring(0, 30)}...` };
                    } else {
                        geminiTestResult = { success: false, message: 'API応答はOKですが、候補がありません' };
                    }
                } else {
                    const error = await response.text();
                    geminiTestResult = { success: false, message: `API応答エラー: ${response.status} - ${error.substring(0, 100)}...` };
                }
            } catch (error) {
                geminiTestResult = { success: false, message: `テスト中にエラー: ${error.message}` };
            }
        }

        return NextResponse.json({
            status: 'success',
            environment: process.env.NODE_ENV,
            variables: envStatus,
            api_tests: {
                gemini: geminiTestResult
            },
            client_features: {
                check_speech_recognition: true  // クライアント側でWeb Speech APIのサポートをチェックするフラグ
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        return NextResponse.json({
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
} 