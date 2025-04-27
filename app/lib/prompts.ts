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
        duration: { start: 0, end: 30 },
        prompt:  `1日の活動内容を時間軸（午前・午後、朝・昼・夕方・夜、〇〇時）でMECEで洗い出します。
洗い出す際にはメインの活動が知れればよいです。`
    },
    MIDDLE_STAGE: {
        duration: { start: 60, end: 90 },
        prompt: `洗い出した活動の中で、端的な質問で活動内容をふかぼります。深ぼる際は良かったこと→課題→次回への修正点の順で質問します`
    },
    CLOSING_STAGE: {
        duration: { start: 90, end: 120 },
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
 * デフォルトの初期メッセージ
 * ユーザーとの会話を開始するための最初のAIメッセージです
 * 会話の冒頭でAIから発せられ、ユーザーの応答を促します
 */
export const DEFAULT_WELCOME_MESSAGE = 'こんにちは、今日は何をしましたか？';

/**
 * 秒数を分と秒の形式に変換する関数
 * 
 * @param seconds - 秒数
 * @returns フォーマットされた時間文字列（例：2分30秒、または30秒）
 */
export function formatElapsedTime(seconds: number): string {
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
 * @param sessionTime - セッション開始時間の情報（省略可能）
 * @returns 初期会話履歴の配列（システムプロンプト＋初期AIメッセージ）
 */
export function createInitialConversationHistory(sessionTime?: SessionTime): PromptTemplate[] {
    // 引数が省略された場合や不正な値の場合にデフォルト値を使用
    // シンプルなデフォルト値を用意して、エラーを回避
    const defaultSessionTime = setSessionStartTime();
    const currentTime = defaultSessionTime.startTime;
    
    const baseHistory = [
        {
            role: 'system' as const,
            content: SYSTEM_PROMPT.content
                .replace('{currentTime}', currentTime)
                .replace('{currentPhase}', TIME_BASED_PROMPTS.EARLY_STAGE.prompt)
                .replace('{remainingTime}', formatElapsedTime(TIME_BASED_PROMPTS.EARLY_STAGE.duration.end))
        },
        {
            role: 'assistant' as const,
            content: DEFAULT_WELCOME_MESSAGE
        }
    ];

    return baseHistory;
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