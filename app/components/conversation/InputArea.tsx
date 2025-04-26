/**
 * app/components/conversation/InputArea.tsx
 * 音声入力エリアのコンポーネント
 */
import React, { useState, KeyboardEvent } from 'react';

interface InputAreaProps {
    isListening: boolean;
    isProcessing: boolean;
    currentTranscript: string;
    toggleListening: () => void;
    onSendMessage: (message: string) => void;
    isDisabled?: boolean;
}

export default function InputArea({ 
    isListening, 
    isProcessing, 
    currentTranscript, 
    toggleListening,
    onSendMessage,
    isDisabled = false
}: InputAreaProps) {
    const [inputText, setInputText] = useState('');
    
    // Enterキーでメッセージを送信
    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey && inputText.trim() && !isProcessing && !isDisabled) {
            e.preventDefault();
            onSendMessage(inputText);
            setInputText('');
        }
    };
    
    // 送信ボタンのクリックハンドラ
    const handleSend = () => {
        if (inputText.trim() && !isProcessing && !isDisabled) {
            onSendMessage(inputText);
            setInputText('');
        }
    };
    
    return (
        <div className="p-4 bg-white border-t">
            <div className="max-w-3xl mx-auto flex items-center gap-2">
                {/* 音声入力表示部分 */}
                {currentTranscript && !isProcessing && (
                    <div className="flex-1 p-3 min-h-12 border rounded-lg bg-green-50 animate-pulse">
                        <div className="break-words">{currentTranscript}</div>
                    </div>
                )}
                
                {/* 処理中の表示 */}
                {isProcessing && (
                    <div className="flex-1 p-3 min-h-12 border rounded-lg bg-pink-50">
                        <div className="flex items-center">
                            <span className="mr-2">AIが考え中...</span>
                            <div className="w-4 h-4 rounded-full bg-pink-300 animate-ping"></div>
                        </div>
                    </div>
                )}
                
                {/* テキスト入力フィールド (会話中かつ音声認識中でない場合に表示) */}
                {!currentTranscript && !isProcessing && (
                    <div className="flex-1 flex">
                        <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={isListening ? "聞いています..." : "メッセージを入力..."}
                            className={`flex-1 p-3 border rounded-l-lg ${isDisabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'} ${isListening ? 'border-green-300' : ''}`}
                            disabled={isDisabled}
                        />
                        <button
                            onClick={handleSend}
                            disabled={!inputText.trim() || isProcessing || isDisabled}
                            className={`px-4 py-2 rounded-r-lg ${!inputText.trim() || isProcessing || isDisabled ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'} text-white`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="22" y1="2" x2="11" y2="13"></line>
                                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                            </svg>
                        </button>
                    </div>
                )}
                
                {/* 音声認識の開始/停止ボタン */}
                <button
                    onClick={toggleListening}
                    disabled={isDisabled}
                    className={`p-3 rounded-full flex-shrink-0 ${isDisabled ? 'bg-gray-400 text-white cursor-not-allowed' :
                        isProcessing ? 'bg-gray-400 text-white cursor-not-allowed' :
                        isListening ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'
                        } transition-all duration-300 hover:scale-110`}
                    title={isListening ? "音声認識を停止" : "音声認識を開始"}
                >
                    {/* 状態に応じてアイコンを切り替え */}
                    {isListening ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="6" y="6" width="12" height="12" />
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                            <line x1="12" y1="19" x2="12" y2="22" />
                        </svg>
                    )}
                </button>
            </div>
            
            {/* 操作ガイドメッセージ */}
            <div className="max-w-3xl mx-auto mt-2 text-center text-sm text-gray-500">
                {isDisabled ? 
                    "会話は終了しました" :
                    isListening ?
                        "自動で音声を認識しています。止めたい場合はボタンを押してください" :
                        (isProcessing ? "AIが応答を考えています..." : "音声かテキストで話しかけてください")}
            </div>
        </div>
    );
} 