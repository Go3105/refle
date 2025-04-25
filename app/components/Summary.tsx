import { useState } from 'react';

interface SummaryProps {
  summary: string;
  onChange: (value: string) => void;
  onSave: () => void;
}

export default function Summary({ summary, onChange, onSave }: SummaryProps) {
  const [isEditing, setIsEditing] = useState(false);
  
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };
  
  const handleSave = () => {
    onSave();
    setIsEditing(false);
  };
  
  const handleEdit = () => {
    setIsEditing(true);
  };
  
  return (
    <div className="mt-8 p-4 bg-white rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-bold text-gray-900">会話のサマリ</h2>
        {!isEditing ? (
          <button
            onClick={handleEdit}
            className="px-3 py-1 text-sm bg-pink-100 text-pink-700 rounded hover:bg-pink-200"
          >
            編集
          </button>
        ) : (
          <button
            onClick={handleSave}
            className="px-3 py-1 text-sm bg-pink-500 text-white rounded hover:bg-pink-600"
          >
            保存
          </button>
        )}
      </div>
      
      {isEditing ? (
        <textarea
          className="w-full p-3 border rounded-md min-h-[150px] focus:outline-none focus:ring-2 focus:ring-pink-300"
          value={summary}
          onChange={handleChange}
          autoFocus
        />
      ) : (
        <div className="p-3 bg-gray-50 rounded min-h-[150px] whitespace-pre-wrap">
          {summary}
        </div>
      )}
      
      <div className="mt-4 text-right text-sm text-gray-500">
        <p>※このサマリはAIによって自動生成されたものです。必要に応じて編集できます。</p>
      </div>
    </div>
  );
} 