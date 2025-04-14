import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const { text, voiceId } = await request.json();

        if (!text) {
            return NextResponse.json({ error: 'テキストが必要です' }, { status: 400 });
        }


        // APIキーは環境変数から取得（.env.localに設定）
        const apiKey = process.env.ELEVEN_LABS_API_KEY;
        if (!apiKey) {
            console.error('[text-to-speech] APIキーが設定されていません');
            return NextResponse.json({ error: 'APIキーが設定されていません。.env.localファイルにELEVEN_LABS_API_KEYを設定してください。' }, { status: 500 });
        }

        const ttsOptions = {
            text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
                stability: 0.5,
                similarity_boost: 0.75
            }
        };

        console.log('[text-to-speech] ElevenLabs APIリクエスト送信中...');
        // ElevenLabs APIを直接呼び出す
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'xi-api-key': apiKey
            },
            body: JSON.stringify(ttsOptions)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[text-to-speech] APIエラー: ${response.status}`, errorText);
            return NextResponse.json({
                error: `ElevenLabs APIエラー: ${response.status} ${response.statusText}`,
                details: errorText
            }, { status: response.status });
        }

        console.log('[text-to-speech] ElevenLabs API呼び出し成功');
        // 音声データを取得
        const audioData = await response.arrayBuffer();

        console.log('[text-to-speech] 音声データサイズ:', audioData.byteLength, 'バイト');
        // 音声データをクライアントに返す
        return new NextResponse(audioData, {
            status: 200,
            headers: {
                'Content-Type': 'audio/mpeg',
                'Cache-Control': 'max-age=3600'
            }
        });
    } catch (error) {
        console.error('[text-to-speech] 音声生成エラー:', error);
        return NextResponse.json({
            error: `音声生成に失敗しました: ${error.message || '不明なエラー'}`
        }, { status: 500 });
    }
