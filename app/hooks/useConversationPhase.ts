import { useState, useEffect } from 'react';
import {
    phaseManager,
    ConversationPhaseManager,
    PhaseConfig,
    calculateElapsedSeconds
} from '../lib/prompts';

interface Phase {
    name: string;
    behavior?: {
        requireSummary?: boolean;
    };
}

/**
 * useConversationPhase フックの戻り値の型定義
 */
export interface UseConversationPhaseReturn {
    currentPhase: PhaseConfig;
    currentPhaseId: string;
    currentPhaseName: string;
    currentPrompt: string;
    remainingTime: number;
    formattedRemainingTime: string;
    elapsedSeconds: number;
    isRequiringSummary: boolean;
    phaseBehavior: any;
    allPhases: PhaseConfig[];
    checkBehavior: (behaviorKey: string) => boolean;
}

/**
 * useConversationPhase フックのオプション
 */
export interface UseConversationPhaseOptions {
    startTime: Date | null;
    customPhaseManager?: ConversationPhaseManager;
    onPhaseChange?: (newPhase: PhaseConfig, oldPhase?: PhaseConfig) => void;
}

/**
 * 会話フェーズを管理するカスタムフック
 * 
 * @param options - フックのオプション
 * @returns フェーズ管理のための関数と状態
 */
export default function useConversationPhase({
    startTime,
    customPhaseManager,
    onPhaseChange
}: UseConversationPhaseOptions): UseConversationPhaseReturn {
    // 使用するフェーズマネージャーを決定
    const manager = customPhaseManager || phaseManager;

    // 状態の初期化
    const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
    const [currentPhase, setCurrentPhase] = useState<PhaseConfig>(manager.getCurrentPhase(0));

    // 経過時間の更新とフェーズ切り替えの監視
    useEffect(() => {
        if (!startTime) return;

        // 経過時間とフェーズの更新関数
        const updatePhase = () => {
            const seconds = Math.floor((new Date().getTime() - startTime.getTime()) / 1000);
            setElapsedSeconds(seconds);

            const newPhase = manager.getCurrentPhase(seconds);

            // フェーズが変わった場合はコールバックを呼び出す
            if (newPhase.id !== currentPhase.id && onPhaseChange) {
                onPhaseChange(newPhase, currentPhase);
            }

            setCurrentPhase(newPhase);
        };

        // 初回実行
        updatePhase();

        // 1秒ごとに更新
        const interval = setInterval(updatePhase, 1000);

        return () => clearInterval(interval);
    }, [startTime, manager, onPhaseChange]);

    // 残り時間の計算
    const remainingTime = manager.getRemainingTimeForPhase(elapsedSeconds);

    // 残り時間のフォーマット
    const formatTime = (seconds: number): string => {
        if (seconds <= 0) return "終了";
        const min = Math.floor(seconds / 60);
        const sec = seconds % 60;
        return `${min > 0 ? `${min}分` : ''}${sec}秒`;
    };

    /**
     * 特定の挙動が必要かどうかをチェックする関数
     */
    const checkBehavior = (behaviorKey: string): boolean => {
        return manager.isBehaviorRequired(elapsedSeconds, behaviorKey);
    };

    return {
        currentPhase,
        currentPhaseId: currentPhase.id,
        currentPhaseName: currentPhase.name,
        currentPrompt: currentPhase.prompt,
        remainingTime,
        formattedRemainingTime: formatTime(remainingTime),
        elapsedSeconds,
        isRequiringSummary: checkBehavior('requireSummary'),
        phaseBehavior: currentPhase.behavior || {},
        allPhases: manager.getAllPhases(),
        checkBehavior
    };
} 