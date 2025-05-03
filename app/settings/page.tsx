'use client';

import { useState } from 'react';
import Link from 'next/link';
import { updateNotionAPIToken, updateNotionDatabaseId } from '@/app/lib/actions';
import { useSession } from 'next-auth/react';

export default function SettingsPage() {
    const [notionApiToken, setNotionApiToken] = useState('');
    const [notionDatabaseId, setNotionDatabaseId] = useState('');
    const [loadingToken, setLoadingToken] = useState(false);
    const [loadingDbId, setLoadingDbId] = useState(false);
    const { data: session, status } = useSession();

    const handleApiTokenChange = async () => {
        if (!session?.user?.email) {
            alert('Googleログインが必要です');
            return;
        }
        setLoadingToken(true);
        try {
            await updateNotionAPIToken({ email: session.user.email, notion_api_token: notionApiToken });
            alert('Notion API Tokenが変更されました');
        } catch (e) {
            alert('変更に失敗しました');
        } finally {
            setLoadingToken(false);
        }
    };

    const handleDatabaseIdChange = async () => {
        if (!session?.user?.email) {
            alert('Googleログインが必要です');
            return;
        }
        setLoadingDbId(true);
        try {
            await updateNotionDatabaseId({ email: session.user.email, notion_database_id: notionDatabaseId });
            alert('Notion Database IDが変更されました');
        } catch (e) {
            alert('変更に失敗しました');
        } finally {
            setLoadingDbId(false);
        }
    };

    return (
        <main className="min-h-screen p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-2xl font-bold mb-6">設定</h1>

                <div className="bg-white p-6 rounded-lg shadow-md mb-6">
                    <h2 className="text-lg font-semibold mb-4">アプリ設定</h2>
                    <div className="mb-4">
                        <label className="block mb-2">Notion API Token</label>
                        <div className="flex items-center">
                            <input
                                type="text"
                                value={notionApiToken}
                                onChange={(e) => setNotionApiToken(e.target.value)}
                                placeholder="Notion API Tokenを入力してください"
                                className="w-full p-2 border rounded mr-2"
                            />
                            <button
                                onClick={handleApiTokenChange}
                                className="bg-green-500 text-white px-2 py-2 rounded hover:bg-green-600"
                                disabled={loadingToken}
                            >
                                {loadingToken ? '変更中...' : '変更'}
                            </button>
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="block mb-2">Notion Database ID</label>
                        <div className="flex items-center">
                            <input
                                type="text"
                                value={notionDatabaseId}
                                onChange={(e) => setNotionDatabaseId(e.target.value)}
                                placeholder="NotionデータベースIDを入力してください"
                                className="w-full p-2 border rounded mr-2"
                            />
                            <button
                                onClick={handleDatabaseIdChange}
                                className="bg-green-500 text-white px-2 py-2 rounded hover:bg-green-600"
                                disabled={loadingDbId}
                            >
                                {loadingDbId ? '変更中...' : '変更'}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex justify-between">
                    <Link href="/" className="text-pink-500 hover:underline">
                        ホームに戻る
                    </Link>
                    <Link href="/profile" className="bg-pink-100 px-4 py-2 rounded hover:bg-pink-200">
                        プロフィールページへ
                    </Link>
                </div>
            </div>
        </main>
    );
} 