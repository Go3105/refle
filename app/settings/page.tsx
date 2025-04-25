'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function SettingsPage() {
    const [notifications, setNotifications] = useState(true);
    const [theme, setTheme] = useState('light');
    const [language, setLanguage] = useState('ja');
    const [showInput, setShowInput] = useState(false);
    const [notionApiToken, setNotionApiToken] = useState('');
    const [notionDatabaseId, setNotionDatabaseId] = useState('');

    // Notion API Tokenの変更ボタン押下時
    const handleApiTokenChange = async () => {
        if (!notionApiToken) {
            alert('Notion API Tokenを入力してください');
            return;
        }
        try {
            const res = await fetch('/api/notion/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notion_api_token: notionApiToken })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                alert('Notion API Tokenが変更されました');
            } else {
                alert(data.error || 'エラーが発生しました');
            }
        } catch (e) {
            alert('通信エラーが発生しました');
        }
    };

    // Notion Database IDの変更ボタン押下時
    const handleDatabaseIdChange = async () => {
        if (!notionDatabaseId) {
            alert('Notion Database IDを入力してください');
            return;
        }
        try {
            const res = await fetch('/api/notion/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notion_database_id: notionDatabaseId })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                alert('Notion Database IDが変更されました');
            } else {
                alert(data.error || 'エラーが発生しました');
            }
        } catch (e) {
            alert('通信エラーが発生しました');
        }
    };

    return (
        <main className="min-h-screen p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-2xl font-bold mb-6">設定</h1>

                <div className="bg-white p-6 rounded-lg shadow-md mb-6">
                    <h2 className="text-lg font-semibold mb-4">アプリ設定</h2>

                    <div className="mb-4">
                        <label className="block mb-2">言語</label>
                        <select
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                            className="w-full p-2 border rounded"
                        >
                            <option value="ja">日本語</option>
                            <option value="en">English</option>
                        </select>
                    </div>

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
                            >
                                変更
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
                            >
                                変更
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