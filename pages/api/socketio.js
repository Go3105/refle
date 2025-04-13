import { Server } from 'socket.io';

export default function handler(req, res) {
    console.log('Socket.IO API ハンドラーが呼び出されました', {
        method: req.method,
        url: req.url
    });

    if (res.socket.server.io) {
        console.log('Socket.IOサーバーは既に実行中です');
        res.end();
        return;
    }

    // Socket.IOサーバーを作成
    try {
        console.log('Socket.IOサーバーをセットアップしています...');
        const io = new Server(res.socket.server, {
            path: '/api/socketio',
            addTrailingSlash: false
        });
        res.socket.server.io = io;
        console.log('Socket.IOサーバーが正常に初期化されました');

        io.on('connection', socket => {
            console.log('クライアント接続:', socket.id);

            // ユーザーからの音声認識テキストを受信
            socket.on('user-speech', text => {
                console.log('ユーザー音声テキスト受信:', text);

                try {
                    // AIの応答を生成（ここでは簡単な応答を返す）
                    let response = '';

                    if (text.includes('疲れ') || text.includes('大変')) {
                        response = 'お疲れ様でした。今日はリラックスする時間を取りましょう。どんなことがあって疲れましたか？';
                    } else if (text.includes('嬉しい') || text.includes('楽しい') || text.includes('良かった')) {
                        response = 'それは素晴らしいですね！どんなことがあって嬉しかったのですか？もう少し詳しく教えていただけますか？';
                    } else if (text.includes('困った') || text.includes('悩み')) {
                        response = 'それは大変でしたね。その問題についてもう少し詳しく聞かせていただけますか？一緒に考えましょう。';
                    } else {
                        response = `「${text}」について、もう少し詳しく教えていただけますか？今日の出来事を振り返ってみましょう。`;
                    }

                    // レスポンスを返す
                    console.log('AIレスポンス送信:', response.substring(0, 50) + '...');
                    socket.emit('ai-response', { text: response });

                    // 音声合成のリクエスト
                    socket.emit('speech-request', { text: response });
                } catch (error) {
                    console.error('AI応答生成エラー:', error);
                    socket.emit('error', { message: '応答の生成に失敗しました' });
                }
            });

            // 切断イベント
            socket.on('disconnect', () => {
                console.log('クライアント切断:', socket.id);
            });
        });

        console.log('Socket.IOルートハンドラーの処理を完了しました');
        res.end();
    } catch (error) {
        console.error('Socket.IOサーバー初期化エラー:', error);
        res.status(500).end();
    }
} 