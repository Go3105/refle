import Image from 'next/image';
import Link from 'next/link';
import AccountMenu from './components/AccountMenu';

export default function Page() {
    return (
        <main className="relative min-h-screen">
            <div className="absolute top-4 right-4">
                <AccountMenu />
            </div>
            <div className="flex justify-center items-center h-screen">
                <div className="text-center">
                    <Image
                        src="/ai_character.png"
                        width={200}
                        height={200}
                        alt="AI character"
                    />
                    <Link
                        href="/conversation"
                        className="mt-[25vh] block rounded-lg bg-pink-100 px-5 py-5 font-serif hover:bg-pink-200"
                    >
                        <p>今日の振り返りを始めるよ</p>
                    </Link>
                </div>
            </div>
        </main>
    );
}
