import React, { useState } from 'react';
import { Mic } from 'lucide-react';

interface VoiceButtonProps {
  onToggle?: () => void;
  isRecording?: boolean;
}

const VoiceButton: React.FC<VoiceButtonProps> = ({ 
  onToggle, 
  isRecording = false 
}) => {
  const [pulseSize, setPulseSize] = useState(1);
  
  const handleClick = () => {
    if (onToggle) onToggle();
  };
  
  return (
    <div className="relative flex items-center justify-center">
      {/* Pulsing circles for active recording */}
      {isRecording && (
        <>
          <div className="absolute w-24 h-24 bg-red-100 rounded-full animate-ping opacity-30"></div>
          <div className="absolute w-20 h-20 bg-red-200 rounded-full opacity-70"></div>
        </>
      )}
      
      <button
        onClick={handleClick}
        className={`relative z-10 p-5 rounded-full shadow-lg transition-all ${
          isRecording
            ? 'bg-red-500 text-white scale-110'
            : 'bg-green-500 text-white hover:bg-green-600 hover:scale-105'
        }`}
      >
        <Mic className="w-8 h-8" />
      </button>
      
      {isRecording && (
        <div className="absolute bottom-[-40px] text-sm font-medium text-gray-600">
          録音中...
        </div>
      )}
    </div>
  );
};

export default VoiceButton; 