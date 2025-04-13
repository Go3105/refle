import { NextRequest, NextResponse } from 'next/server';
import { ElevenLabsClient } from 'elevenlabs';

export async function POST(request: NextRequest) {
  try {
    const { text, voiceId } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'テキストが必要です' }, { status: 400 });
    }

    // APIキーは環境変数から取得（.env.localに設定）
    const apiKey = process.env.ELEVEN_LABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'APIキーが設定されていません' }, { status: 500 });
    }

    const client = new ElevenLabsClient({
      apiKey
    });

    const ttsOptions = {
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75
      }
    };

    // ElevenLabs APIにリクエストを送信
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
      return NextResponse.json({ error: `APIリクエストが失敗しました: ${errorText}` }, { status: response.status });
    }

    // 音声データをクライアントに返す
    const audioData = await response.arrayBuffer();
    return new NextResponse(audioData, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg'
      }
    });
  } catch (error) {
    console.error('音声生成エラー:', error);
    return NextResponse.json({ error: '音声生成に失敗しました' }, { status: 500 });
  }
} 