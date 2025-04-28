/**
 * app/lib/prompts.ts
 * ===========================================
 * アプリケーション全体で使用するプロンプトテンプレートを定義するファイル
 * このファイルは、AIモデル（Gemini）向けのシステムプロンプトと初期メッセージを管理します。
 * Socket.IOサーバーからも参照され、一貫したプロンプト管理を実現します。
 */

/**
 * プロンプトテンプレートのインターフェース
 * AIとの会話における各メッセージの構造を定義します
 * 
 * @property role - メッセージの送信者（system:システム指示、user:ユーザー、assistant:AI）
 * @property content - メッセージの内容
 */
export interface PromptTemplate {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

/**
 * フェーズの設定を定義するインターフェース
 */
export interface PhaseConfig {
    id: string;
    name: string;
    duration: { start: number; end: number };
    prompt: string;
    behavior?: {
        temperature?: number;
        maxOutputTokens?: number;
        requireSummary?: boolean;
        showVisualHint?: boolean;
        soundEffect?: string;
        // 追加の挙動設定を定義可能
    };
}

/**
 * 会話フェーズの定義
 * フェーズごとの設定を管理します
 */
export const CONVERSATION_PHASES: PhaseConfig[] = [
    {
        id: 'early_stage',
        name: '活動洗い出し',
        duration: { start: 0, end: 60 },
        prompt: `1日の活動内容を時間軸（午前・午後、朝・昼・夕方・夜、〇〇時）でMECEで洗い出します。
洗い出す際にはメインの活動が知れればよいです。`,
        behavior: {
            temperature: 0.7,
            maxOutputTokens: 100,
            showVisualHint: true,
        }
    },
    {
        id: 'middle_stage',
        name: '深掘り',
        duration: { start: 60, end: 120 },
        prompt: `洗い出した活動の中で、端的な質問で活動内容をふかぼります。深ぼる際は良かったこと→課題→次回への修正点の順で質問します`,
        behavior: {
            temperature: 0.8,
            maxOutputTokens: 150,
            showVisualHint: true,
        }
    },
    {
        id: 'closing_stage',
        name: 'クロージング',
        duration: { start: 120, end: 180 },
        prompt: `クロージングをします`,
        behavior: {
            temperature: 0.7,
            maxOutputTokens: 200,
            requireSummary: true,
            showVisualHint: true,
        }
    },
    // 新しいフェーズを追加する場合はここに定義
    /* 例:
    {
        id: 'reflection_stage',
        name: '振り返り',
        duration: { start: 120, end: 150 },
        prompt: `今日の活動から特に重要な点を3つ抽出し、明日に向けてのアクションプランを考えます`,
        behavior: {
            temperature: 0.6,
            maxOutputTokens: 250,
            requireSummary: false,
            showVisualHint: true,
        }
    },
    */
];

// 後方互換性のために従来の定義も維持
export const TIME_BASED_PROMPTS = {
    EARLY_STAGE: CONVERSATION_PHASES[0],
    MIDDLE_STAGE: CONVERSATION_PHASES[1],
    CLOSING_STAGE: CONVERSATION_PHASES[2],
};

/**
 * メインのシステムプロンプト
 * AIモデルに対する基本的な指示を含み、会話の性質と方向性を決定します
 * このプロンプトは会話の最初に送信され、AIの応答スタイルや機能を設定します
 */
export const SYSTEM_PROMPT: PromptTemplate = {
    role: 'system',
    content: `プロの1on1コーチです。
ユーザーの一日の振り返りを手伝います。

現在知りたいこと: 
{currentPhase}
本テーマは残り{remainingTime}です

従うガイドライン：
1. "現在知りたいこと"を時間内に聞き出す
2. 相手の言葉を引き出すための質問を続けます
3. 相手が話した内容に関連する質問を行います
4. 常に日本語で応答します
5. 質問は最大30字です

context:
現在の時間は{currentTime}
`
};

/**
 * 会話フェーズ管理クラス
 * 経過時間に基づいたフェーズの取得と管理を行います
 */
export class ConversationPhaseManager {
    private phases: PhaseConfig[];
    
    constructor(phases: PhaseConfig[] = CONVERSATION_PHASES) {
        this.phases = phases;
    }
    
    /**
     * 現在のフェーズを取得
     * @param elapsedSeconds - 経過秒数
     * @returns 現在のフェーズ設定
     */
    getCurrentPhase(elapsedSeconds: number): PhaseConfig {
        for (const phase of this.phases) {
            if (elapsedSeconds >= phase.duration.start && elapsedSeconds < phase.duration.end) {
                return phase;
            }
        }
        // デフォルトは最後のフェーズを返す
        return this.phases[this.phases.length - 1];
    }
    
    /**
     * フェーズのプロンプトを取得
     * @param elapsedSeconds - 経過秒数
     * @returns プロンプト文字列
     */
    getPromptForPhase(elapsedSeconds: number): string {
        return this.getCurrentPhase(elapsedSeconds).prompt;
    }
    
    /**
     * フェーズの残り時間を計算
     * @param elapsedSeconds - 経過秒数
     * @returns 残り秒数
     */
    getRemainingTimeForPhase(elapsedSeconds: number): number {
        const currentPhase = this.getCurrentPhase(elapsedSeconds);
        return currentPhase.duration.end - elapsedSeconds;
    }
    
    /**
     * フェーズの挙動設定を取得
     * @param elapsedSeconds - 経過秒数
     * @returns 挙動設定オブジェクト
     */
    getBehaviorForPhase(elapsedSeconds: number): any {
        return this.getCurrentPhase(elapsedSeconds).behavior || {};
    }
    
    /**
     * 特定の挙動が必要かどうかを確認
     * @param elapsedSeconds - 経過秒数
     * @param behaviorKey - 確認する挙動キー
     * @returns 必要かどうかのブール値
     */
    isBehaviorRequired(elapsedSeconds: number, behaviorKey: string): boolean {
        const behavior = this.getBehaviorForPhase(elapsedSeconds);
        return !!behavior[behaviorKey];
    }
    
    /**
     * すべてのフェーズを取得
     * @returns フェーズの配列
     */
    getAllPhases(): PhaseConfig[] {
        return this.phases;
    }
    
    /**
     * 秒数を分と秒の形式に変換する関数
     * 
     * @param seconds - 秒数
     * @returns フォーマットされた時間文字列（例：2分30秒、または30秒）
     */
    formatElapsedTime(seconds: number): string {
        // 絶対値を使用して常に正の値で計算
        const absSeconds = Math.abs(seconds);
        const minutes = Math.floor(absSeconds / 60);
        const remainingSeconds = absSeconds % 60;
        
        // 分がある場合は「分秒」、ない場合は「秒」だけ表示
        if (minutes > 0) {
            return `${minutes}分${remainingSeconds}秒`;
        } else {
            return `${remainingSeconds}秒`;
        }
    }
    
    /**
     * 残り時間を文字列で取得
     * 
     * @param elapsedSeconds - 経過秒数
     * @returns 残り時間の文字列（例：残り5分30秒）
     */
    getFormattedRemainingTime(elapsedSeconds: number): string {
        const remainingSeconds = this.getRemainingTimeForPhase(elapsedSeconds);
        if (remainingSeconds <= 0) {
            return "終了";
        }
        return this.formatElapsedTime(remainingSeconds);
    }
    
    /**
     * システムプロンプトを生成する
     * 
     * @param elapsedSeconds - 経過秒数
     * @param currentTime - 現在の時間
     * @returns 現在のフェーズと残り時間を含むシステムプロンプト
     */
    createSystemPrompt(elapsedSeconds: number, currentTime: string): PromptTemplate {
        const currentPhase = this.getPromptForPhase(elapsedSeconds);
        const remainingTime = this.getFormattedRemainingTime(elapsedSeconds);
        return {
            role: 'system',
            content: SYSTEM_PROMPT.content
                .replace('{currentTime}', currentTime)
                .replace('{currentPhase}', currentPhase)
                .replace('{remainingTime}', remainingTime)
        };
    }
    
    /**
     * 初期会話履歴を生成する
     * 
     * @param currentTime - 現在の時間
     * @returns 初期会話履歴の配列
     */
    createInitialConversationHistory(currentTime: string): PromptTemplate[] {
        return [
            {
                role: 'system',
                content: SYSTEM_PROMPT.content
                    .replace('{currentTime}', currentTime)
                    .replace('{currentPhase}', this.getPromptForPhase(0))
                    .replace('{remainingTime}', this.formatElapsedTime(CONVERSATION_PHASES[0].duration.end))
            },
            {
                role: 'assistant',
                content: DEFAULT_WELCOME_MESSAGE
            }
        ];
    }
}

// グローバルなフェーズマネージャーインスタンス
export const phaseManager = new ConversationPhaseManager();

/**
 * セッション開始時間を管理するための型定義
 */
export interface SessionTime {
    startTime: string;
    startTimestamp: number;
}

/**
 * セッション開始時間を設定する関数
 * 
 * @returns セッション開始時間の情報
 */
export function setSessionStartTime(): SessionTime {
    const now = new Date();
    const startTime = now.toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    const startTimestamp = now.getTime();
    
    return {
        startTime,
        startTimestamp
    };
}

/**
 * 経過時間を計算する関数
 * 
 * @param startTimestamp - セッション開始時のタイムスタンプ
 * @returns 経過秒数
 */
export function calculateElapsedSeconds(startTimestamp: number): number {
    const now = new Date().getTime();
    return Math.floor((now - startTimestamp) / 1000);
}

/**
 * 後方互換性のための関数群
 */

// 秒数を分と秒の形式に変換する関数
export function formatElapsedTime(seconds: number): string {
    return phaseManager.formatElapsedTime(seconds);
}

// 経過時間に応じた現在のフェーズを取得する関数
export function getCurrentPhase(elapsedSeconds: number): string {
    return phaseManager.getPromptForPhase(elapsedSeconds);
}

// 残り時間を計算する関数
export function calculateRemainingTime(elapsedSeconds: number): string {
    return phaseManager.getFormattedRemainingTime(elapsedSeconds);
}

// システムプロンプトを生成する関数
export function createSystemPrompt(elapsedSeconds: number, currentTime: string): PromptTemplate {
    return phaseManager.createSystemPrompt(elapsedSeconds, currentTime);
}

// 初期会話履歴を生成する関数
export function createInitialConversationHistory(sessionTime?: SessionTime): PromptTemplate[] {
    // 引数が省略された場合や不正な値の場合にデフォルト値を使用
    const defaultSessionTime = setSessionStartTime();
    const currentTime = sessionTime?.startTime || defaultSessionTime.startTime;
    
    return phaseManager.createInitialConversationHistory(currentTime);
}

export const SUMMARY_PROMPT = {
    role: 'system',
    content: `以下の会話履歴を基に、以下の形式でサマリを作成してください：

1. 主な活動内容
2. 良かった点
3. 課題点
4. 次回への改善点

会話履歴:
{conversationHistory}`
};

// デフォルトのウェルカムメッセージ
export const DEFAULT_WELCOME_MESSAGE = 'こんにちは、今日は何をしましたか？'; 