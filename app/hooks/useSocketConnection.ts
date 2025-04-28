/**
 * app/hooks/useSocketConnection.ts
 * Socket.IO接続と関連イベントを処理するカスタムフック
 */
import { useState, useRef, useEffect } from 'react';
import type { Socket } from 'socket.io-client';

interface SocketConnectionCallbacks {
    onConnect?: () => void;
    onAiResponse?: (data: { text: string }) => void;
    onReadyForNextInput?: (data: { keep_listening?: boolean; reset_state?: boolean }) => void;
    onAudioStream?: (data: { audio: string; contentType: string }) => void;
    onTtsStatus?: (data: { status: string; error?: string }) => void;
    onError?: (error: SocketError) => void;
    onDisconnect?: () => void;
}

interface SocketEventData {
    text?: string;
    audio?: string;
    contentType?: string;
    keep_listening?: boolean;
    reset_state?: boolean;
    [key: string]: unknown;
}

interface SocketEvent {
    type: string;
    data: SocketEventData;
}

interface SocketError {
    message: string;
    code?: string;
}

export function useSocketConnection(callbacks: SocketConnectionCallbacks = {}) {
    const [isConnected, setIsConnected] = useState(false);
    const socketRef = useRef<Socket | null>(null);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        let isMounted = true;

        /**
         * Socket.IO初期化関数
         */
        const initSocket = async () => {
            try {
                // サーバーサイドのSocket.IOを初期化
                console.log('Socket.IO初期化APIを呼び出しています...');
                const response = await fetch('/api/socketio');
                console.log('Socket.IO初期化API応答:', response.status);

                if (!isMounted) return;

                // Socket.IOクライアントをダイナミックインポート
                console.log('Socket.IOクライアントを初期化しています...');
                const { io } = await import('socket.io-client');

                // Socket.IOクライアントを作成
                const socket = io('', {
                    path: '/api/socketio',
                    reconnectionAttempts: 10,
                    reconnectionDelay: 1000,
                    timeout: 60000,
                    transports: ['websocket', 'polling'],
                    autoConnect: true
                });

                // 接続エラーイベントの処理
                socket.on('connect_error', (err) => {
                    console.error('Socket.IO接続エラー:', err);
                    if (isMounted) setIsConnected(false);
                });

                socketRef.current = socket;

                // 接続イベント
                socket.on('connect', () => {
                    console.log('Socket.IO接続成功:', socket.id);
                    setIsConnected(true);
                    callbacks.onConnect?.();
                });

                // AIの応答受信イベント
                socket.on('ai-response', (data) => {
                    console.log('AI応答受信:', data);
                    callbacks.onAiResponse?.(data);
                });

                // 次の入力準備完了イベント
                socket.on('ready-for-next-input', (data) => {
                    console.log('次の入力準備完了:', data);
                    callbacks.onReadyForNextInput?.(data);
                });

                // 音声ストリーム受信イベント
                socket.on('audio-stream', (data) => {
                    console.log('音声ストリーム受信:', data.text.substring(0, 30) + '...');
                    callbacks.onAudioStream?.(data);
                });

                // 音声合成状態イベント
                socket.on('tts-status', (data) => {
                    console.log('音声合成状態:', data);
                    callbacks.onTtsStatus?.(data);
                });

                // エラーイベント
                socket.on('error', (error) => {
                    console.error('Socket.IOエラー:', error);
                    callbacks.onError?.(error);
                });

                // 切断イベント
                socket.on('disconnect', () => {
                    console.log('Socket.IO切断');
                    if (isMounted) {
                        setIsConnected(false);
                        callbacks.onDisconnect?.();
                    }
                });
            } catch (error) {
                console.error('Socket.IO初期化エラー:', error);
                if (isMounted) setIsConnected(false);
            }
        };

        initSocket();

        // クリーンアップ関数
        return () => {
            isMounted = false;
            isMountedRef.current = false;
            disconnect();
        };
    }, [callbacks]);

    /**
     * Socket接続を送信する
     */
    const sendMessage = (eventName: string, data: SocketEventData) => {
        if (socketRef.current && isConnected) {
            socketRef.current.emit(eventName, data);
            return true;
        }
        return false;
    };

    /**
     * Socket接続を切断する
     */
    const disconnect = () => {
        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current.removeAllListeners();
            socketRef.current = null;
            setIsConnected(false);
        }
    };

    return {
        isConnected,
        socketRef,
        sendMessage,
        disconnect
    };
} 