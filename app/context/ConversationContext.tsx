'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface ConversationContextType {
  conversationStartTime: Date | null;
  startConversation: () => void;
  resetConversation: () => void;
}

const ConversationContext = createContext<ConversationContextType | undefined>(undefined);

export function ConversationProvider({ children }: { children: ReactNode }) {
  const [conversationStartTime, setConversationStartTime] = useState<Date | null>(null);

  const startConversation = () => {
    if (!conversationStartTime) {
      console.log('会話開始時間を設定:', new Date());
      setConversationStartTime(new Date());
    }
  };

  const resetConversation = () => {
    setConversationStartTime(null);
  };

  return (
    <ConversationContext.Provider value={{ 
      conversationStartTime, 
      startConversation, 
      resetConversation 
    }}>
      {children}
    </ConversationContext.Provider>
  );
}

export function useConversation() {
  const context = useContext(ConversationContext);
  if (context === undefined) {
    throw new Error('useConversation must be used within a ConversationProvider');
  }
  return context;
} 