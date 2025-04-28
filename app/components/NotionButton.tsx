'use client';

import { useState } from 'react';

interface NotionButtonProps {
    summary: string;
}

export default function NotionButton({ summary }: NotionButtonProps) {
    const [isLoading, setIsLoading] = useState(false);

    const handleAddToNotion = async () => {
        try {
            setIsLoading(true);
            const response = await fetch('/api/notion', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ summary }),
            });

            if (!response.ok) {
                throw new Error('Failed to create Notion page');
            }

            const data = await response.json();
            console.log('Successfully added page to Notion:', data);
        } catch (error) {
            console.error('Error adding page to Notion:', error);
            alert('Notionページの作成に失敗しました。');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen p-4 relative">
            {/* Main content area */}
            <div className="mb-16">
                {/* Add your main content here */}
            </div>

            {/* Fixed button container */}
            <div className="fixed bottom-8 right-8">
                <button
                    onClick={handleAddToNotion}
                    disabled={isLoading}
                    className={`
                        bg-black hover:bg-gray-800 text-white 
                        px-6 py-2 rounded-lg shadow-lg
                        disabled:opacity-50 disabled:cursor-not-allowed
                        flex items-center gap-2
                    `}
                >
                    {isLoading ? (
                        <>
                            <span className="animate-spin">⏳</span>
                            <span>追加中...</span>
                        </>
                    ) : (
                        'Notionに追加'
                    )}
                </button>
            </div>
        </div>
    );
}