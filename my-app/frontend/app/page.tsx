import Image from 'next/image';
import Link from 'next/link';

export default function Page() {
    return (
        <main className="flex justify-center items-center h-screen">
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
                    <p>今日の振り返りを始める</p>
                </Link>
            </div>
        </main >
    );
}
