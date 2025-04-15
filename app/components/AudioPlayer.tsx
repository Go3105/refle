'use client';

import { useState, useEffect, useRef } from 'react';

interface AudioPlayerProps {
    text: string;
    voiceId?: string;
    autoPlay?: boolean;
}

export default function AudioPlayer({
    text,
    voiceId = 'JBFqnCBsd6RMkjVDRZzb', // デフォルトの音声ID
    autoPlay = false
}: AudioPlayerProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const hasTriedGeneratingAudio = useRef(false);

    // コンポーネントがマウントされたときに一度だけ音声生成
    useEffect(() => {
        if (text && autoPlay && !hasTriedGeneratingAudio.current) {
            console.log('[AudioPlayer] コンポーネントマウント時の初期化', { text: text.substring(0, 50) });
            hasTriedGeneratingAudio.current = true;
            handleGenerateAudio();
        }

        // クリーンアップ関数
        return () => {
            // コンポーネントがアンマウントされるときに音声を停止
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }

            // Blobの解放
            if (audioUrl) {
                URL.revokeObjectURL(audioUrl);
            }
        };
    }, []);  // 空の依存配列で一度だけ実行

    const handleGenerateAudio = async () => {
        if (!text || isLoading) return;

        setIsLoading(true);
        console.log('[AudioPlayer] 音声生成開始', { text: text.substring(0, 50) });
        try {
            // サーバーサイドのAPIエンドポイントにリクエスト
            const response = await fetch('/api/text-to-speech', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text,
                    voiceId
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `APIリクエストが失敗しました: ${response.status}`);
            }

            console.log('[AudioPlayer] サーバーからのレスポンス受信');
            // レスポンスからBlobを取得
            const audioBlob = await response.blob();
            const url = URL.createObjectURL(audioBlob);

            setAudioUrl(url);
            console.log('[AudioPlayer] 音声URL作成完了');

            // 自動再生
            if (autoPlay) {
                console.log('[AudioPlayer] 自動再生開始');
                playAudio(url);
            }
        } catch (error) {
            console.error('[AudioPlayer] 音声生成エラー:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const playAudio = (url: string) => {
        console.log('[AudioPlayer] 音声再生', { audioUrl: url.substring(0, 50) + '...' });
        // 既存の音声を停止
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }

        // 新しい音声を作成
        const newAudio = new Audio(url);
        newAudio.onended = () => {
            console.log('[AudioPlayer] 音声再生終了');
            setIsPlaying(false);
        };
        newAudio.onpause = () => setIsPlaying(false);
        newAudio.play().catch(error => {
            console.error('[AudioPlayer] 音声再生エラー:', error);
            setIsPlaying(false);
        });

        audioRef.current = newAudio;
        setIsPlaying(true);
    };

    const handlePlayAudio = () => {
        if (audioUrl) {
            playAudio(audioUrl);
        } else {
            handleGenerateAudio();
        }
    };

    return (
        <div className="mt-2">
            <button
                onClick={handlePlayAudio}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300"
            >
                {isLoading ? '読み込み中...' : isPlaying ? '再生中...' : '音声を再生'}
            </button>
        </div>
    );
} 