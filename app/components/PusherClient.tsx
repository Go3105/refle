import { useEffect } from "react";
import Pusher from "pusher-js";

// Props型を定義
interface PusherClientProps {
    channelName: string;
    onAIResponse: (text: string) => void;
    onAudio: (audio: string) => void;
}

export default function PusherClient({ channelName, onAIResponse, onAudio }: PusherClientProps) {
    useEffect(() => {
        const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
        const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
        if (!key || !cluster) {
            throw new Error("Pusherの環境変数が設定されていません");
        }
        const pusher = new Pusher(key, { cluster });
        const channel = pusher.subscribe(channelName);

        channel.bind("ai-response", (data: { text: string }) => {
            onAIResponse(data.text);
        });

        channel.bind("audio-stream", (data: { audio: string }) => {
            onAudio(data.audio);
        });

        return () => {
            channel.unbind_all();
            channel.unsubscribe();
            pusher.disconnect();
        };
    }, [channelName, onAIResponse, onAudio]);

    return null;
}