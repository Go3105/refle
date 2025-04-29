export const runtime = "edge";

// 必要なモジュールをインポート
import { NextRequest, NextResponse } from 'next/server'; // Next.jsのHTTPリクエスト/レスポンス処理用
import { GoogleGenAI } from '@google/genai'; // Google Gemini AIのSDK
import {
    createInitialConversationHistory, // 会話履歴の初期化関数
    createSystemPrompt, // システムプロンプト（AIへの指示）を作成する関数
    setSessionStartTime, // セッション開始時間を設定する関数
    SessionTime, // セッション時間の型定義
    SUMMARY_PROMPT // 会話サマリー作成用のプロンプトテンプレート
} from '@/app/lib/prompts';

// Google Gemini APIキーの存在チェック（環境変数から取得）
// 環境変数が設定されていない場合はエラーを投げる
if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set in environment variables');
}

// Google Gemini APIクライアントの初期化
const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

/**
 * セッション管理用のシングルトンクラス
 * シングルトンパターン: アプリケーション全体で唯一のインスタンスを保証する設計パターン
 * 会話の履歴や時間を管理する
 */
interface ConversationMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

// セッション管理用のクラス
class SessionManager {
    // クラスの唯一のインスタンスを保持する静的変数
    private static instance: SessionManager;
    // セッション開始時間などの情報を保持
    private sessionTime: SessionTime | null = null;
    // 会話履歴を配列として保持
    private conversationHistory: ConversationMessage[] = [];

    // プライベートコンストラクタ（外部からのインスタンス生成を防ぐ）
    private constructor() { }

    /**
     * SessionManagerのインスタンスを取得するメソッド
     * 初回呼び出し時にインスタンスを生成し、以降は同じインスタンスを返す
     */
    public static getInstance(): SessionManager {
        if (!SessionManager.instance) {
            SessionManager.instance = new SessionManager();
        }
        return SessionManager.instance;
    }

    /**
     * 現在のセッション時間情報を取得
     */
    public getSessionTime(): SessionTime | null {
        return this.sessionTime;
    }

    /**
     * 現在の会話履歴を取得
     */
    public getConversationHistory(): ConversationMessage[] {
        return this.conversationHistory;
    }

    /**
     * セッションをリセット（新しい会話を始める時に使用）
     * 時間を現在時刻に設定し、会話履歴を初期化する
     */
    public resetSession(): void {
        this.sessionTime = setSessionStartTime();
        this.conversationHistory = createInitialConversationHistory(this.sessionTime);
    }

    /**
     * セッションの初期化（まだ初期化されていない場合のみ実行）
     * 最初のメッセージが送られた時に呼ばれる
     */
    public initializeSession(): void {
        if (!this.sessionTime) {
            this.sessionTime = setSessionStartTime();
            this.conversationHistory = createInitialConversationHistory(this.sessionTime);
        }
    }

    /**
     * 経過時間に基づいてシステムプロンプトを更新
     * 会話の長さや時間経過に応じてAIの振る舞いを調整するために使用
     * @param elapsedSeconds 会話開始からの経過秒数
     */
    public updateSystemPrompt(elapsedSeconds: number): void {
        if (this.sessionTime) {
            const systemPrompt = createSystemPrompt(elapsedSeconds, this.sessionTime.startTime);
            this.conversationHistory[0] = systemPrompt; // 配列の先頭（システムプロンプト）を更新
        }
    }

    /**
     * 会話履歴にメッセージを追加
     * @param role メッセージの送信者（'user'または'assistant'）
     * @param content メッセージの内容
     */
    public addMessage(role: 'user' | 'assistant', content: string): void {
        this.conversationHistory.push({ role, content });
    }
}

/**
 * HTTPリクエスト用のオプション型定義
 */
interface FetchOptions {
    method: string;
    headers: Record<string, string>;
    body: string;
}


/**
 * APIのPOSTエンドポイント処理関数
 * フロントエンドからのリクエストを処理し、Gemini APIと通信する
 * @param request Next.jsのリクエストオブジェクト
 */

interface GeminiResponse {
    candidates: Array<{
        content: {
            parts: Array<{
                text: string;
            }>;
        };
    }>;
}

export async function POST(request: NextRequest) {
    try {
        // セッションマネージャーのインスタンスを取得
        const sessionManager = SessionManager.getInstance();

        // リクエストボディ（JSON）の解析
        let body;
        try {
            body = await request.json();
        } catch (error) {
            // JSONの解析に失敗した場合はエラーレスポンスを返す
            return NextResponse.json(
                { error: 'Invalid JSON in request body' },
                { status: 400 } // 400: Bad Request（クライアントエラー）
            );
        }

        // リクエストから必要なパラメータを取り出す
        const { message, reset, elapsedSeconds, createSummary, messages } = body;

        // サマリ作成リクエストの処理
        if (createSummary) {
            // 会話履歴データを格納する変数
            let conversationData;

            // デバッグログ出力
            console.log('サマリ作成リクエスト受信:', {
                hasMessages: !!messages, // messagesがあるかどうか
                messagesLength: messages ? messages.length : 0 // messagesの長さ
            });

            if (messages && Array.isArray(messages) && messages.length > 0) {
                // フロントエンドから直接提供された会話履歴がある場合
                console.log('フロントエンドから提供されたメッセージを処理します');

                try {
                    // メッセージ形式をGemini AI用に変換
                    const formattedMessages = messages.map(msg => ({
                        role: msg.role === 'assistant' ? 'assistant' : 'user',
                        content: msg.content
                    }));
                    // JSON文字列に変換（整形して表示するためにnull, 2を指定）
                    conversationData = JSON.stringify(formattedMessages, null, 2);
                    console.log(`${messages.length}件のメッセージを変換しました`);
                } catch (error) {
                    // 変換エラー時の処理
                    console.error('メッセージ変換エラー:', error);
                    // エラー時は元のデータをそのまま使用
                    conversationData = JSON.stringify(messages, null, 2);
                }
            } else {
                // フロントエンドからメッセージが提供されていない場合はセッションから取得
                console.log('セッションマネージャーから会話履歴を取得します');
                const conversationHistory = sessionManager.getConversationHistory();
                conversationData = JSON.stringify(conversationHistory, null, 2);
                console.log(`セッションから${conversationHistory.length}件のメッセージを取得しました`);
            }

            // 会話データが空でないか確認
            if (!conversationData || conversationData === '[]' || conversationData === '{}') {
                console.warn('会話データが空です。デフォルトのメッセージを返します。');
                return NextResponse.json({
                    summary: '申し訳ありませんが、会話履歴が提供されていません。そのため、サマリを作成することができません。'
                });
            }

            console.log('サマリ作成プロンプトを準備しています');
            // テンプレート内のプレースホルダーを実際の会話データで置換
            const summaryPrompt = SUMMARY_PROMPT.content.replace('{conversationHistory}', conversationData);

            // プロンプト内容をログに出力（全文）
            console.log('サマリ作成プロンプト内容:');
            console.log(summaryPrompt);

            try {
                console.log('Gemini APIにリクエストを送信します');
                // Gemini AI モデル指定
                const model = 'gemini-2.0-flash-lite';
                // ストリーミング形式でレスポンスを取得（一部ずつ返ってくる）
                const response = await ai.models.generateContentStream({
                    model,
                    contents: [{ role: 'user', parts: [{ text: summaryPrompt }] }]
                });

                // レスポンスの各チャンクを結合して完全な応答を作成
                let fullResponse = '';
                for await (const chunk of response) {
                    fullResponse += chunk.text;
                }

                // 応答の最初の100文字をログに出力（長すぎる場合は省略）
                console.log('サマリ生成完了:', fullResponse.substring(0, 100) + '...');
                // 生成されたサマリをJSONとしてクライアントに返す
                return NextResponse.json({ summary: fullResponse });
            } catch (error) {
                // Gemini API呼び出しエラー時の処理
                console.error('Gemini APIエラー:', error);
                return NextResponse.json({
                    summary: 'サマリの生成中にエラーが発生しました。申し訳ありませんが、再度お試しください。',
                    error: error.message
                }, { status: 500 }); // 500: Internal Server Error（サーバーエラー）
            }
        }

        // セッションリセットリクエストの処理
        if (reset) {
            sessionManager.resetSession();
            console.log('会話履歴をリセットしました');
            return NextResponse.json({
                success: true,
                message: '会話履歴をリセットしました'
            });
        }

        // 初回メッセージの場合はセッションを初期化
        sessionManager.initializeSession();

        // メッセージが提供されていない場合はエラー
        if (!message) {
            return NextResponse.json(
                { error: 'Message is required' },
                { status: 400 }
            );
        }

        // 経過時間情報がある場合、それに応じてシステムプロンプトを更新
        // （長時間会話が続く場合などに会話の文脈を保持するため）
        if (elapsedSeconds !== undefined) {
            sessionManager.updateSystemPrompt(elapsedSeconds);
        }

        // ユーザーのメッセージを会話履歴に追加
        sessionManager.addMessage('user', message);
        console.log('ユーザー:', message);

        // Gemini AIの応答生成設定
        const config = {
            responseMimeType: 'text/plain', // 応答のMIMEタイプ（テキスト形式）
            temperature: 0.7,  // 応答のランダム性（0=決定的、1=ランダム）
            topP: 0.95,        // 次の単語を選ぶ際の確率閾値
            topK: 40,          // 次の単語の候補数
            maxOutputTokens: 800, // 最大出力トークン数（文字数に近い単位）
            stopSequences: [],    // 生成を停止する文字列（ここでは設定なし）
        };

        // 使用するGemini AIモデルを指定
        const model = 'gemini-2.0-flash-lite';

        // 会話履歴をGemini AI形式に変換
        // 内部の形式とGemini APIが期待する形式は若干異なる
        const contents = sessionManager.getConversationHistory().map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user', // 'assistant'を'model'に変換
            parts: [{ text: msg.content }] // contentをparts.textに変換
        }));

        // システムプロンプトの内容をログに出力（全文）
        console.log('システムプロンプト内容:');
        console.log(contents[0]?.parts[0]?.text);

        // Gemini APIを呼び出してレスポンスをストリーミング形式で取得
        const response = await ai.models.generateContentStream({
            model,
            config,
            contents,
        });

        // ストリーミングレスポンスの各チャンクを結合して完全な応答を作成
        let fullResponse = '';
        for await (const chunk of response) {
            fullResponse += chunk.text;
        }

        // AIの応答を会話履歴に追加
        sessionManager.addMessage('assistant', fullResponse);

        // デバッグ情報のログ出力
        console.log('AI:', fullResponse);
        console.log('--- 会話履歴 ---');
        sessionManager.getConversationHistory().forEach((msg, index) => {
            console.log(`${index + 1}. ${msg.role}: ${msg.content}`);
        });
        console.log('---------------');

        // 成功レスポンスをクライアントに返す
        // AIの応答と会話履歴全体を含む
        return NextResponse.json({
            success: true,
            response: fullResponse,
            history: sessionManager.getConversationHistory()
        });
    } catch (error) {
        // 未処理のエラーが発生した場合の処理
        console.error('Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error.message || 'Internal server error',
                // 開発環境の場合のみスタックトレースを含める（本番環境ではセキュリティのため非表示）
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined
            },
            { status: 500 } // 500: Internal Server Error
        );
    }
} 