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
 * 時間帯ごとのプロンプト定義
 * 会話の進行に応じて使用するプロンプトを管理します
 */
export const TIME_BASED_PROMPTS = {
    EARLY_STAGE: {
        duration: { start: 0, end: 60 },
        prompt:  `1日の活動内容を時間軸（午前・午後、朝・昼・夕方・夜、〇〇時）でMECEで洗い出します。
洗い出す際にはメインの活動が知れればよいです。`
    },
    MIDDLE_STAGE: {
        duration: { start: 60, end: 540 },
        prompt: `洗い出した活動の中で、端的な質問で活動内容をふかぼります。深ぼる際は良かったこと→課題→次回への修正点の順で質問します`
    },
    CLOSING_STAGE: {
        duration: { start: 540, end: 600 },
        prompt:  `クロージングをします `
    }
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
このテーマは残り{remainingTime}です

従うガイドライン：
1. "現在知りたいこと"の目的を達成できるように質問します
2. 残り時間を参考にタイムスケジューリングも行います
3. 相手の言葉を引き出すための質問を続けます
4. 相手が話した内容に関連する質問を行います
5. 常に日本語で応答します
6. 質問は最大30字です

context:
現在の時間は{currentTime}
`
};

/**
 * デフォルトの初期メッセージ
 * ユーザーとの会話を開始するための最初のAIメッセージです
 * 会話の冒頭でAIから発せられ、ユーザーの応答を促します
 */
export const DEFAULT_WELCOME_MESSAGE = 'こんにちは、今日は何をしましたか？';

/**
 * 秒数を分と秒の形式に変換する関数
 * 
 * @param seconds - 秒数
 * @returns フォーマットされた時間文字列（例：2分30秒）
 */
export function formatElapsedTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}分${remainingSeconds}秒`;
}

/**
 * 経過時間に応じた現在のフェーズを取得する関数
 * 
 * @param elapsedSeconds - 会話開始からの経過秒数
 * @returns 現在のフェーズの文字列（時間情報を含む）
 */
export function getCurrentPhase(elapsedSeconds: number): string {
    const timeString = formatElapsedTime(elapsedSeconds);

    if (elapsedSeconds >= TIME_BASED_PROMPTS.EARLY_STAGE.duration.start && 
        elapsedSeconds < TIME_BASED_PROMPTS.EARLY_STAGE.duration.end) {
        return TIME_BASED_PROMPTS.EARLY_STAGE.prompt;
    } else if (elapsedSeconds >= TIME_BASED_PROMPTS.MIDDLE_STAGE.duration.start && elapsedSeconds < TIME_BASED_PROMPTS.MIDDLE_STAGE.duration.end) {
        return TIME_BASED_PROMPTS.MIDDLE_STAGE.prompt;
    } else if (elapsedSeconds >= TIME_BASED_PROMPTS.CLOSING_STAGE.duration.start && elapsedSeconds < TIME_BASED_PROMPTS.CLOSING_STAGE.duration.end) {
        return TIME_BASED_PROMPTS.CLOSING_STAGE.prompt;
    }
    return TIME_BASED_PROMPTS.CLOSING_STAGE.prompt;
}

/**
 * 残り時間を計算する関数
 * 
 * @param elapsedSeconds - 経過秒数
 * @returns 残り時間の文字列（例：残り5分30秒）
 */
export function calculateRemainingTime(elapsedSeconds: number): string {
    let remainingSeconds = 0;
    
    if (elapsedSeconds < TIME_BASED_PROMPTS.EARLY_STAGE.duration.end) {
        remainingSeconds = TIME_BASED_PROMPTS.EARLY_STAGE.duration.end - elapsedSeconds;
    } else if (elapsedSeconds < TIME_BASED_PROMPTS.MIDDLE_STAGE.duration.end) {
        remainingSeconds = TIME_BASED_PROMPTS.MIDDLE_STAGE.duration.end - elapsedSeconds;
    } else if (elapsedSeconds < TIME_BASED_PROMPTS.CLOSING_STAGE.duration.end) {
        remainingSeconds = TIME_BASED_PROMPTS.CLOSING_STAGE.duration.end - elapsedSeconds;
    } else {
        return "終了";
    }
    
    return `${formatElapsedTime(remainingSeconds)}`;
}

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
 * システムプロンプトを生成する関数
 * 
 * @param elapsedSeconds - 会話開始からの経過秒数
 * @param currentTime - 現在の時間
 * @returns 現在のフェーズと残り時間を含むシステムプロンプト
 */
export function createSystemPrompt(elapsedSeconds: number, currentTime: string): PromptTemplate {
    const currentPhase = getCurrentPhase(elapsedSeconds);
    const remainingTime = calculateRemainingTime(elapsedSeconds);
    return {
        role: 'system',
        content: SYSTEM_PROMPT.content
            .replace('{currentTime}', currentTime)
            .replace('{currentPhase}', currentPhase)
            .replace('{remainingTime}', remainingTime)
    };
}

/**
 * 初期会話履歴を生成する関数
 * システムプロンプトと初期メッセージを含む会話の初期状態を作成します
 * 
 * @param sessionTime - セッション開始時間の情報
 * @returns 初期会話履歴の配列（システムプロンプト＋初期AIメッセージ）
 */
export function createInitialConversationHistory(sessionTime: SessionTime): PromptTemplate[] {
    const elapsedSeconds = calculateElapsedSeconds(sessionTime.startTimestamp);
    
    const baseHistory = [
        createSystemPrompt(elapsedSeconds, sessionTime.startTime),
        {
            role: 'assistant' as const,
            content: DEFAULT_WELCOME_MESSAGE
        }
    ];

    return baseHistory;
} 