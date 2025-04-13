'use client';

import { useState, useEffect } from 'react';

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
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);

  // テキストが変更されたら音声URLをリセット
  useEffect(() => {
    setAudioUrl(null);
  }, [text]);

  // autoPlayが有効で、テキストがある場合は自動再生
  useEffect(() => {
    if (autoPlay && text && !audioUrl) {
      handleGenerateAudio();
    }
  }, [autoPlay, text, audioUrl]);

  const handleGenerateAudio = async () => {
    if (!text) return;
    
    setIsLoading(true);
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

      // レスポンスからBlobを取得
      const audioBlob = await response.blob();
      const url = URL.createObjectURL(audioBlob);
      
      setAudioUrl(url);
      
      // 自動再生
      if (autoPlay) {
        playAudio(url);
      }
    } catch (error) {
      console.error('音声生成エラー:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const playAudio = (url: string) => {
    // 既存の音声を停止
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }

    // 新しい音声を作成
    const newAudio = new Audio(url);
    newAudio.onended = () => setIsPlaying(false);
    newAudio.onpause = () => setIsPlaying(false);
    newAudio.play().catch(error => {
      console.error('音声再生エラー:', error);
      setIsPlaying(false);
    });
    
    setAudio(newAudio);
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
    <div className="mt-4">
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