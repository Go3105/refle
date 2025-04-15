import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const { message } = await request.json();

        if (!message) {
            return NextResponse.json({ error: 'メッセージが必要です' }, { status: 400 });
        }

        // ここでは簡単な応答を返していますが、実際にはAI APIを呼び出す処理を実装します
        // 例：OpenAI APIなど

        // 簡単な応答パターン
        let response = '';

        if (message.includes('疲れ') || message.includes('大変')) {
            response = 'お疲れ様でした。今日はリラックスする時間を取りましょう。どんなことがあって疲れましたか？';
        } else if (message.includes('嬉しい') || message.includes('楽しい') || message.includes('良かった')) {
            response = 'それは素晴らしいですね！どんなことがあって嬉しかったのですか？もう少し詳しく教えていただけますか？';
        } else if (message.includes('困った') || message.includes('悩み')) {
            response = 'それは大変でしたね。その問題についてもう少し詳しく聞かせていただけますか？一緒に考えましょう。';
        } else {
            response = `「${message}」について、もう少し詳しく教えていただけますか？今日の出来事を振り返ってみましょう。`;
        }

        // 応答を返す
        return NextResponse.json({ response });

    } catch (error) {
        console.error('会話エラー:', error);
        return NextResponse.json({ error: '応答の生成に失敗しました' }, { status: 500 });
    }
} 