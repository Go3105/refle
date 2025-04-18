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
 * メインのシステムプロンプト
 * AIモデルに対する基本的な指示を含み、会話の性質と方向性を決定します
 * このプロンプトは会話の最初に送信され、AIの応答スタイルや機能を設定します
 */
export const SYSTEM_PROMPT: PromptTemplate = {

  role: 'system',
  content: `プロの1on1コーチです。
ユーザーの一日の振り返りを手伝ってください。

従うガイドライン：
1. 相手の言葉を引き出すための質問を続けてください
2. 一度に1〜2つの質問だけをしてください
3. ユーザーが話した内容に関連する質問をするようにしてください
4. 短く、自然な会話を心がけてください
5. 専門的な用語は避け、親しみやすい言葉で話してください
6. 常に日本語で応答してください

この会話はリアルタイム音声で行われるため、短く自然な応答を心がけてください。`
};

/**
 * デフォルトの初期メッセージ
 * ユーザーとの会話を開始するための最初のAIメッセージです
 * 会話の冒頭でAIから発せられ、ユーザーの応答を促します
 */
export const DEFAULT_WELCOME_MESSAGE = 'こんにちは、今日は何をしましたか？';

/**
 * 初期会話履歴を生成する関数
 * システムプロンプトと初期メッセージを含む会話の初期状態を作成します
 * 
 * @returns 初期会話履歴の配列（システムプロンプト＋初期AIメッセージ）
 */
export function createInitialConversationHistory(): PromptTemplate[] {
    return [
        SYSTEM_PROMPT,
        {
            role: 'assistant',
            content: DEFAULT_WELCOME_MESSAGE
        }
    ];
} 