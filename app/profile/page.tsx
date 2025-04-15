import Link from 'next/link';

export default function ProfilePage() {
    return (
        <main className="min-h-screen p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-2xl font-bold mb-6">プロフィール</h1>

                <div className="bg-white p-6 rounded-lg shadow-md">
                    <div className="mb-6">
                        <h2 className="text-lg font-semibold mb-2">ユーザー情報</h2>
                        <p className="mb-1">名前: ユーザー</p>
                        <p className="mb-1">メール: user@example.com</p>
                        <p>登録日: 2023年4月1日</p>
                    </div>

                    <div className="mb-6">
                        <h2 className="text-lg font-semibold mb-2">活動統計</h2>
                        <p className="mb-1">振り返り回数: 42回</p>
                        <p>最近の振り返り: 2023年10月15日</p>
                    </div>

                    <div className="flex justify-between">
                        <Link href="/" className="text-pink-500 hover:underline">
                            ホームに戻る
                        </Link>
                        <Link href="/settings" className="bg-pink-100 px-4 py-2 rounded hover:bg-pink-200">
                            設定ページへ
                        </Link>
                    </div>
                </div>
            </div>
        </main>
    );
} 