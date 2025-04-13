import { NextRequest, NextResponse } from 'next/server';

// 簡易的なキャッシュ（本番環境ではRedisなどのキャッシュサービスを検討）
const cache = new Map<string, ArrayBuffer>();

export async function POST(request: NextRequest) {
  try {
    const { text, voiceId } = await request.json();
    console.log(`[text-to-speech] リクエスト受信: ${new Date().toISOString()}`, { text: text.substring(0, 50), voiceId });

    if (!text) {
      return NextResponse.json({ error: 'テキストが必要です' }, { status: 400 });
    }

    // キャッシュキーを生成
    const cacheKey = `${text}_${voiceId}`;
    
    // キャッシュにあればそれを返す
    if (cache.has(cacheKey)) {
      console.log(`[text-to-speech] キャッシュヒット: ${cacheKey.substring(0, 30)}...`);
      const cachedData = cache.get(cacheKey);
      return new NextResponse(cachedData, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'max-age=3600'
        }
      });
    }

    // APIキーは環境変数から取得（.env.localに設定）
    const apiKey = process.env.ELEVEN_LABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'APIキーが設定されていません' }, { status: 500 });
    }

    const ttsOptions = {
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75
      }
    };

    console.log(`[text-to-speech] ElevenLabs APIリクエスト開始: ${new Date().toISOString()}`);
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
      console.error(`[text-to-speech] APIエラー: ${response.status}`, errorText);
      return NextResponse.json({ error: `APIリクエストが失敗しました: ${errorText}` }, { status: response.status });
    }

    console.log(`[text-to-speech] ElevenLabs APIリクエスト完了: ${new Date().toISOString()}`);
    // 音声データを取得
    const audioData = await response.arrayBuffer();
    
    // キャッシュに保存（1時間程度の短いセッション用）
    cache.set(cacheKey, audioData);
    
    console.log(`[text-to-speech] レスポンス送信: ${new Date().toISOString()}, サイズ: ${audioData.byteLength}バイト`);
    return new NextResponse(audioData, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'max-age=3600'
      }
    });
  } catch (error) {
    console.error('[text-to-speech] 音声生成エラー:', error);
    return NextResponse.json({ error: '音声生成に失敗しました' }, { status: 500 });
  }
} 