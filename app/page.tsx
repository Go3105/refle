export const runtime = 'edge';
import { auth } from '@/auth';
import TopPage from './components/TopPage';

export default async function Page() {
    const session = await auth();
    const userName = session?.user?.name || 'ゲスト';
    return (
        <div>
            <TopPage username={userName} />
        </div>
    )
}

// Web Speech API 型定義（最低限）
interface MySpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    running: boolean;
    startPending: boolean;
    start(): void;
    stop(): void;
    onresult: ((event: Event) => void) | null;
    onend: (() => void) | null;
    onaudioend: (() => void) | null;
    onspeechstart: (() => void) | null;
    onspeechend: (() => void) | null;
}
