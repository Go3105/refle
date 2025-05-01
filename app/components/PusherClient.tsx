import { useEffect } from "react";
import Pusher from "pusher-js";

export default function PusherClient({ channelName, onAIResponse, onAudio }) {
    useEffect(() => {
        const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
        const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
        if (!key || !cluster) {
            throw new Error("Pusherの環境変数が設定されていません");
        }
        const pusher = new Pusher(key, { cluster });
        const channel = pusher.subscribe(channelName);

        channel.bind("ai-response", (data) => {
            onAIResponse(data.text);
        });

        channel.bind("audio-stream", (data) => {
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