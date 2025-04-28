/**
 * app/components/conversation/InputArea.tsx
 * 音声入力エリアのコンポーネント
 */
import React from 'react';
import { Mic } from 'lucide-react';

interface InputAreaProps {
    isListening: boolean;
    isProcessing: boolean;
    currentTranscript: string;
    toggleListening: () => void;
    onSendMessage: (message: string) => void;
    onEndSession: () => void;
    isDisabled?: boolean;
}

export default function InputArea({ 
    isListening, 
    isProcessing, 
    currentTranscript, 
    toggleListening,
    onSendMessage,
    onEndSession,
    isDisabled = false
}: InputAreaProps) {
    
    return (
        <div className="bg-white border-t border-gray-200 p-4">
            <div className="flex flex-col items-center">
                {/* 音声認識中の表示 */}
                {isListening && currentTranscript ? (
                    <div className="w-full mb-4 p-3 border border-gray-300 rounded-full bg-green-50">
                        {currentTranscript}
                    </div>
                ) : isListening ? (
                    <div className="w-full mb-4 p-3 border border-gray-300 rounded-full bg-gray-50">
                        どうぞお話しください...
                    </div>
                ) : isProcessing ? (
                    <div className="w-full mb-4 p-3 border border-gray-300 rounded-full bg-gray-50">
                        AIが考え中...
                    </div>
                ) : null}
                
                {/* マイクボタン */}
                <button
                    type="button"
                    onClick={toggleListening}
                    disabled={isDisabled || isProcessing}
                    className={`p-5 rounded-full transition-all mb-4 ${
                        isListening 
                            ? 'bg-red-500 text-white animate-pulse' 
                            : isDisabled || isProcessing
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                : 'bg-green-500 text-white hover:bg-green-600'
                    }`}
                >
                    <Mic className="h-8 w-8" />
                </button>
                
                {/* 会話終了ボタン */}
                <button
                    onClick={onEndSession}
                    className="px-6 py-2.5 bg-green-500 text-white rounded-full hover:bg-green-600 transition-all"
                >
                    会話を終了してサマリを作成
                </button>
            </div>
            
            {/* 操作ガイドメッセージ */}
            <div className="text-center text-xs mt-4 text-gray-500">
                {isDisabled ? 
                    "会話は終了しました" :
                    isProcessing ? 
                        "AIが応答を考えています..." :
                        isListening ?
                            currentTranscript ? 
                                "音声を認識しています..." : 
                                "マイクがオンです。お話しください" :
                            "マイクボタンを押して会話を始めてください"
                }
            </div>
        </div>
    );
} 