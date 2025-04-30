/**
 * pages/api/socketio.js
 * ===========================================
 * Socket.IOサーバーを設定し、リアルタイム通信を処理するAPIエンドポイント
 * 
 * このファイルでは以下の機能を提供します：
 * 1. クライアント（ブラウザ）との双方向リアルタイム通信
 * 2. ユーザーの音声入力テキストの受信と処理
 * 3. Gemini APIを使用したAI応答の生成
 * 4. ElevenLabs APIを使用した音声合成
 * 5. 会話履歴の管理
 */

import { Server } from 'socket.io';
import {
    createInitialConversationHistory
} from '../../app/lib/prompts';

// Edge ランタイムは Socket.IO と互換性がないため削除
// export const runtime = 'edge';

/**
 * Socket.IO APIハンドラー
 * Next.jsのAPIルートハンドラー関数
 * 
 * @param {Object} req - リクエストオブジェクト
 * @param {Object} res - レスポンスオブジェクト
 */
export default function handler(req, res) {
    console.log('Socket.IO API ハンドラーが呼び出されました', {
        method: req.method,
        url: req.url
    });

    try {
        // res.socketからHTTPサーバーにアクセスする方法を確認
        const httpServer = res.socket.server;

        // サーバーインスタンスが既に存在する場合は再利用
        if (httpServer.io) {
            console.log('Socket.IOサーバーは既に実行中です');
            res.end();
            return;
        }

        console.log('Socket.IOサーバーをセットアップしています...');

        // Socket.IOサーバーインスタンスの作成
        const io = new Server(httpServer, {
            cors: {
                origin: [
                    "http://localhost:3000",
                    "https://refle-gos-projects-9c59c4ab.vercel.app/"
                ],
            },
            path: '/api/socketio', // APIパス
            addTrailingSlash: false, // パスの末尾にスラッシュを追加しない
            pingTimeout: 6000,  // 接続タイムアウト（6秒）
            pingInterval: 2500, // ping間隔（2.5秒）
        },
        );

        // サーバーインスタンスをHTTPサーバーオブジェクトに保存して再利用できるようにする
        httpServer.io = io;
        console.log('Socket.IOサーバーが正常に初期化されました');

        // クライアント接続時のイベントハンドラー
        io.on('connection', socket => {
            console.log('クライアント接続:', socket.id);

            /**
             * クライアント固有の状態を保持するオブジェクト
             * 各クライアント接続ごとに独立した状態を管理
             */
            const clientState = {
                isProcessing: false,        // 処理中フラグ
                lastResponseTime: Date.now(), // 最後の応答時間
                // プロンプトライブラリから初期会話履歴を作成
                // 引数なしで呼び出し - 関数内部でデフォルト値が使用される
                conversationHistory: createInitialConversationHistory(),
                sequenceCounter: 1
            };

            /**
             * 初期メッセージを自動送信
             * クライアント接続後、少し遅延させて初期メッセージを送信
             */
            setTimeout(() => {
                // 初期メッセージは会話履歴から取得
                const welcomeMessage = clientState.conversationHistory[1].content;

                // テキスト応答を送信（UI表示用）
                socket.emit('ai-response', { text: welcomeMessage });

                // 少し遅延させてから音声合成リクエストを送信（UIが先に更新されるように）
                setTimeout(() => {
                    // ElevenLabs APIを使用して音声合成
                    generateSpeech(welcomeMessage, socket);

                    // 音声合成の開始後、さらに遅延させてから音声認識開始の準備完了通知を送信
                    setTimeout(() => {
                        // 音声認識がすぐに開始されるように通知（継続リスニングモードを有効化）
                        sendReadyForNextInput(socket, {
                            keep_listening: true,
                            first_message: true
                        });
                    }, 2000); // 音声合成開始から2秒後
                }, 500);  // UI更新から0.5秒後
            }, 2000);  // 接続から2秒後

            /**
             * ReadyForNextInputイベントを送信する関数
             * 状態とデータを統一して送信するためのユーティリティ関数
             * 
             * @param {Object} socket - Socket.IOソケットオブジェクト
             * @param {Object} options - 追加オプション
             */
            function sendReadyForNextInput(socket, options = {}) {
                const timestamp = Date.now();
                console.log('次の入力準備完了信号を送信', {
                    timestamp,
                    ...options
                });

                // 基本設定
                const eventData = {
                    status: 'ready',
                    keep_listening: true,
                    timestamp,
                    sequence_id: clientState.sequenceCounter++,
                    reset_state: true,
                    ...options
                };

                // イベント送信
                socket.emit('ready-for-next-input', eventData);

                // イベント直後の処理完了確認
                setTimeout(() => {
                    clientState.isProcessing = false;
                    console.log('★次の入力受付準備完了、isProcessing =', clientState.isProcessing);
                }, 100);
            }

            /**
             * ユーザーからの音声認識テキスト受信イベントハンドラー
             * クライアントから送信された音声認識結果を処理
             * 
             * @param {string} text - 音声認識されたテキスト
             */
            socket.on('user-speech', text => {
                // デバッグ：受信したテキストを必ず記録
                console.log('★ユーザー発話イベント受信:', text);

                // 連続した同じメッセージや短すぎるメッセージは処理しない（無音や認識エラー対策）
                if (!text || text.trim().length < 2) {
                    // 音声認識を継続させる
                    sendReadyForNextInput(socket, {
                        keep_listening: true,
                        first_message: false
                    });
                    return;
                }

                // ログ追加: isProcessing状態をデバッグ
                console.log('ユーザー発話受信、現在の処理状態:', clientState.isProcessing, '会話履歴長:', clientState.conversationHistory.length);

                // 処理中状態でも強制的に処理する（連続対話対応）
                if (clientState.isProcessing) {
                    console.log('★処理中ですが、新しいリクエストを受け付けます:', text);
                    // 強制的にプロセッシングフラグをリセット
                    clientState.isProcessing = false;
                }

                // このプロセスが処理中であることを明示的に設定
                clientState.isProcessing = true;
                console.log('処理を開始します。isProcessing = true');

                // 前回の応答から1秒以内の場合は少し待機（連続発話対策）
                const timeSinceLastResponse = Date.now() - clientState.lastResponseTime;
                if (timeSinceLastResponse < 1000) {
                    // 連続したリクエストの場合は少し待機
                    setTimeout(() => {
                        processUserSpeech(text);
                    }, 1000 - timeSinceLastResponse);
                } else {
                    processUserSpeech(text);
                }
            });

            /**
             * ユーザー音声テキストの処理関数
             * テキストをGemini APIに送信し、応答を生成
             * 
             * @param {string} text - 処理するテキスト
             */
            async function processUserSpeech(text) {
                console.log('ユーザー音声テキスト受信:', text);
                console.log('処理状態確認:', clientState.isProcessing);

                // 会話履歴にユーザーメッセージを追加
                clientState.conversationHistory.push({
                    role: 'user',
                    content: text
                });

                try {
                    // Gemini APIを呼び出して応答を取得
                    console.log('Gemini APIリクエスト送信中... 会話履歴長:', clientState.conversationHistory.length);

                    // 会話が長すぎる場合は短くする（最新の10件を保持、トークン制限対策）
                    let contextMessages = [...clientState.conversationHistory];
                    if (contextMessages.length > 11) {
                        // システムメッセージは常に保持し、それ以外の最新10件を取得
                        const systemMessage = contextMessages[0];
                        const recentMessages = contextMessages.slice(-10);
                        contextMessages = [systemMessage, ...recentMessages];
                    }

                    // Gemini APIを直接呼び出すための準備
                    const apiKey = process.env.GEMINI_API_KEY;
                    if (!apiKey) {
                        throw new Error('GEMINI_API_KEYが設定されていません。.env.localファイルで設定してください。');
                    }

                    // Gemini 2.0 Flash API用のリクエスト形式に変換
                    // システムメッセージはGeminiではサポートされていないため、ユーザーメッセージに変換
                    const geminiMessages = contextMessages.map(msg => {
                        if (msg.role === 'system') {
                            return { role: 'user', parts: [{ text: msg.content }] };
                        } else if (msg.role === 'assistant') {
                            return { role: 'model', parts: [{ text: msg.content }] };
                        } else {
                            return { role: 'user', parts: [{ text: msg.content }] };
                        }
                    });

                    // Gemini API呼び出し
                    console.log('Gemini API呼び出し開始...');
                    const response = await fetch(
                        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                contents: geminiMessages,
                                generationConfig: {
                                    temperature: 0.7,       // 創造性の度合い（0-1）
                                    maxOutputTokens: 800,   // 最大出力トークン数
                                    topP: 0.95,             // 上位確率カットオフ
                                    topK: 40                // 上位選択肢数
                                }
                            })
                        }
                    );
                    console.log('Gemini API呼び出し完了、レスポンス取得中...');

                    // エラーレスポンスの処理
                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error(`Gemini APIエラー: ${response.status}`, errorText);
                        throw new Error(`Gemini APIエラー: ${response.status} ${response.statusText}`);
                    }

                    // 応答データの解析
                    const data = await response.json();

                    // 応答検証
                    if (!data.candidates || data.candidates.length === 0) {
                        throw new Error('Gemini APIからの応答が空です');
                    }

                    // テキスト応答の抽出
                    const aiResponse = data.candidates[0].content.parts[0].text;

                    if (!aiResponse) {
                        throw new Error('AIからの応答が空です');
                    }

                    console.log('Gemini API応答取得:', aiResponse.substring(0, 50) + '...');

                    // クライアント状態を検証
                    if (clientState.isProcessing !== true) {
                        console.warn('警告: プロセス中フラグが不適切な状態です:', clientState.isProcessing);
                        clientState.isProcessing = true;
                    }

                    // 会話履歴にAIの応答を追加
                    clientState.conversationHistory.push({
                        role: 'assistant',
                        content: aiResponse
                    });

                    // 処理に少し時間がかかっているように見せる（より自然な対話感を演出）
                    setTimeout(() => {
                        // テキスト応答をクライアントに送信
                        console.log('AIレスポンス送信:', aiResponse.substring(0, 50) + '...');
                        socket.emit('ai-response', { text: aiResponse });

                        // ログ追加: 音声合成に進みます
                        console.log('ai-responseイベント送信完了、音声合成に進みます');

                        // 少し遅延してから音声合成を実行
                        setTimeout(() => {
                            // ElevenLabs APIを使用して音声合成
                            generateSpeech(aiResponse, socket);

                            // 最後の応答時間を記録
                            clientState.lastResponseTime = Date.now();
                            clientState.isProcessing = false;
                            console.log('処理完了: isProcessingをfalseに設定しました', Date.now());

                            // 音声合成開始から十分な時間が経過した後に次の入力準備完了を通知
                            console.log('音声合成開始、3秒後に次の入力準備完了信号を送信します');

                            setTimeout(() => {
                                console.log('次の入力準備完了信号を送信します');
                                // 統一関数を使って送信
                                sendReadyForNextInput(socket, {
                                    source: 'ai_response_complete',
                                    reset_state: true
                                });
                            }, 3000); // 3秒後に音声認識を再開できるようにする
                        }, 300);
                    }, 800);
                } catch (error) {
                    // エラー処理
                    console.error('AI応答生成エラー:', error);
                    socket.emit('error', { message: `応答の生成に失敗しました: ${error.message}` });

                    // エラー状態をリセット
                    clientState.isProcessing = false;
                    clientState.lastResponseTime = Date.now();
                    console.log('エラー発生: isProcessingをfalseに設定しました', Date.now());

                    // 会話履歴からエラーになったユーザーメッセージを削除（再試行のため）
                    if (clientState.conversationHistory.length > 1) {
                        clientState.conversationHistory.pop();
                    }

                    // エラー時も次の入力を促す（音声認識は継続）
                    sendReadyForNextInput(socket, {
                        error: true
                    });

                    // 確実に処理状態をリセット
                    setTimeout(() => {
                        clientState.isProcessing = false;
                        console.log('★エラー後の状態リセット完了、isProcessing =', clientState.isProcessing);
                    }, 500);
                }
            }

            /**
             * ElevenLabs APIを使用して音声合成を行う関数
             * 
             * @param {string} text - 音声合成するテキスト
             * @param {Object} socket - Socket.IOソケットオブジェクト
             */
            async function generateSpeech(text, socket) {
                try {
                    const apiKey = process.env.ELEVENLABS_API_KEY;
                    if (!apiKey) {
                        throw new Error('ELEVENLABS_API_KEYが設定されていません。.env.localファイルで設定してください。');
                    }

                    // 音声合成リクエストを送信中であることをクライアントに通知
                    socket.emit('tts-status', { status: 'generating' });

                    // ElevenLabs APIを呼び出して音声合成
                    const voiceId = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB'; // デフォルトのボイスID
                    const response = await fetch(
                        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
                        {
                            method: 'POST',
                            headers: {
                                'Accept': 'audio/mpeg',
                                'Content-Type': 'application/json',
                                'xi-api-key': apiKey
                            },
                            body: JSON.stringify({
                                text: text,
                                model_id: 'eleven_flash_v2_5',
                                voice_settings: {
                                    stability: 0.5,
                                    similarity_boost: 0.75,
                                    style: 0.0,
                                    use_speaker_boost: true
                                }
                            })
                        }
                    );

                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error(`ElevenLabs APIエラー: ${response.status}`, errorText);
                        throw new Error(`音声合成に失敗しました: ${response.status} ${response.statusText}`);
                    }

                    // オーディオデータをArrayBufferとして取得
                    const audioBuffer = await response.arrayBuffer();
                    // Base64エンコード
                    const base64Audio = Buffer.from(audioBuffer).toString('base64');

                    // 音声データをクライアントに送信
                    socket.emit('audio-stream', {
                        audio: base64Audio,
                        contentType: 'audio/mpeg',
                        text: text
                    });

                    console.log('音声合成完了、音声データを送信しました');

                    // 3秒後に次の入力準備完了を送信（明示的なタイムアウト）
                    setTimeout(() => {
                        console.log('音声合成完了後、次の入力準備完了信号を送信します');
                        // 統一関数を使って送信
                        sendReadyForNextInput(socket, {
                            source: 'speech_synthesis_complete'
                        });
                    }, 3000);
                } catch (error) {
                    console.error('音声合成エラー:', error);
                    socket.emit('tts-error', { message: error.message });
                }
            }

            /**
             * 音声合成エラーの通知受信イベントハンドラー
             * クライアントから送信された音声合成エラーを処理
             * 
             * @param {Object} data - エラーデータ
             */
            socket.on('tts-error', (data) => {
                console.log('音声合成エラー通知を受信:', data);

                // エラー発生時は即座に次の入力準備完了を送信
                clientState.isProcessing = false;
                clientState.lastResponseTime = Date.now();

                // 音声認識を継続させる通知
                console.log('エラー発生により即座に次の入力準備完了信号を送信');
                sendReadyForNextInput(socket, {
                    error: true
                });

                // 確実に状態をリセット
                setTimeout(() => {
                    clientState.isProcessing = false;
                    console.log('★TTS-Errorで状態をリセットしました。isProcessing =', clientState.isProcessing);
                }, 200);
            });

            /**
             * クライアントからのピンポン（接続確認）イベントハンドラー
             * クライアントの接続状態を確認するためのシンプルな応答
             */
            socket.on('ping', () => {
                console.log('Pingイベント受信。現在の状態:', { isProcessing: clientState.isProcessing });
                socket.emit('pong', {
                    time: Date.now(),
                    isProcessing: clientState.isProcessing,
                    historyLength: clientState.conversationHistory.length
                });
            });

            /**
             * クライアント切断イベントハンドラー
             * クライアントが切断した際の処理
             */
            socket.on('disconnect', () => {
                console.log('クライアント切断:', socket.id);
            });

            // クライアント接続時に初期化
            clientState.sequenceCounter = 1;
        });

        console.log('Socket.IOルートハンドラーの処理を完了しました');
        res.end();
    } catch (error) {
        // Socket.IOサーバーの初期化エラー処理
        console.error('Socket.IOサーバー初期化エラー:', error);
        res.status(500).end();
    }
} 