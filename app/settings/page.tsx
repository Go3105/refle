'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function SettingsPage() {
    const [notifications, setNotifications] = useState(true);
    const [theme, setTheme] = useState('light');
    const [language, setLanguage] = useState('ja');

    return (
        <main className="min-h-screen p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-2xl font-bold mb-6">設定</h1>

                <div className="bg-white p-6 rounded-lg shadow-md mb-6">
                    <h2 className="text-lg font-semibold mb-4">アプリ設定</h2>

                    <div className="mb-4">
                        <label className="flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={notifications}
                                onChange={() => setNotifications(!notifications)}
                                className="w-4 h-4 mr-2"
                            />
                            <span>通知を受け取る</span>
                        </label>
                    </div>

                    <div className="mb-4">
                        <label className="block mb-2">テーマ</label>
                        <select
                            value={theme}
                            onChange={(e) => setTheme(e.target.value)}
                            className="w-full p-2 border rounded"
                        >
                            <option value="light">ライト</option>
                            <option value="dark">ダーク</option>
                            <option value="system">システム設定に合わせる</option>
                        </select>
                    </div>

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