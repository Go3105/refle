/**
 * app/components/conversation/SummaryDisplay.tsx
 * 会話サマリを表示・編集するコンポーネント
 */
import React from 'react';

interface SummaryDisplayProps {
    summary: string;
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    onSave: () => void;
    isEditing: boolean;
}

export default function SummaryDisplay({ summary, onChange, onSave, isEditing }: SummaryDisplayProps) {
    return (
        <div className="mt-8 p-4 bg-white rounded-lg shadow">
            <h2 className="text-lg font-bold mb-2">会話のサマリ</h2>
            <form className="space-y-3">
                <textarea 
                    className="w-full p-2 border rounded-md min-h-[150px]"
                    value={summary}
                    onChange={onChange}
                    readOnly={!isEditing}
                ></textarea>
                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={onSave}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        保存
                    </button>
                </div>
                
                {/* フッターメッセージ */}
                <div className="mt-2 text-right text-sm text-gray-500">
                    <p>※このサマリはAIによって自動生成されたものです。必要に応じて編集できます。</p>
                </div>
            </form>
        </div>
    );
} 