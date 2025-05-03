'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { registerUser } from '@/app/lib/actions';
import { useSession } from 'next-auth/react';

export default function RegisterPage() {
    const [notionApiToken, setNotionApiToken] = useState('');
    const [notionDatabaseId, setNotionDatabaseId] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const { data: session, status } = useSession();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const email = session?.user?.email;
        if (!email) {
            alert('Googleログインが必要です');
            setLoading(false);
            return;
        }
        try {
            await registerUser({
                email,
                notion_api_token: notionApiToken,
                notion_database_id: notionDatabaseId,
            });
            alert('登録が完了しました');
            router.push('/');
        } catch (e) {
            alert('登録に失敗しました');
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-2xl font-bold mb-6">Notion連携情報の登録</h1>
                <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md mb-6">
                    <div className="mb-4">
                        <label className="block mb-2">Notion API Token</label>
                        <input
                            type="text"
                            value={notionApiToken}
                            onChange={(e) => setNotionApiToken(e.target.value)}
                            placeholder="Notion API Tokenを入力してください"
                            className="w-full p-2 border rounded"
                            required
                        />
                    </div>
                    <div className="mb-4">
                        <label className="block mb-2">Notion Database ID</label>
                        <input
                            type="text"
                            value={notionDatabaseId}
                            onChange={(e) => setNotionDatabaseId(e.target.value)}
                            placeholder="NotionデータベースIDを入力してください"
                            className="w-full p-2 border rounded"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                        disabled={loading}
                    >
                        {loading ? '登録中...' : '登録'}
                    </button>
                </form>
            </div>
        </main>
    );
}