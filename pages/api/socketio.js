/**
 * pages/api/socketio.js
 * ===========================================
 * Socket.IOサーバーを設定し、リアルタイム通信を処理するAPIエンドポイント
 * 
 * このファイルでは以下の機能を提供します：
 * 1. クライアント（ブラウザ）との双方向リアルタイム通信
 * 2. ユーザーの音声入力テキストの受信と処理
 * 3. Gemini APIを使用したAI応答の生成
 * 4. クライアントへの応答と音声合成リクエストの送信
 * 5. 会話履歴の管理
 */

import { Server } from 'socket.io';
import { 
  createInitialConversationHistory
} from '../../app/lib/prompts';

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

  // サーバーインスタンスが既に存在する場合は再利用
  if (res.socket.server.io) {
    console.log('Socket.IOサーバーは既に実行中です');
    res.end();
    return;
  }

  // Socket.IOサーバーを作成
  try {
    console.log('Socket.IOサーバーをセットアップしています...');
    
    // Socket.IOサーバーインスタンスの作成
    const io = new Server(res.socket.server, {
      path: '/api/socketio', // APIパス
      addTrailingSlash: false, // パスの末尾にスラッシュを追加しない
      pingTimeout: 6000,  // 接続タイムアウト（6秒）
      pingInterval: 2500, // ping間隔（2.5秒）
    });
    
    // サーバーインスタンスをレスポンスオブジェクトに保存して再利用できるようにする
    res.socket.server.io = io;
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
        conversationHistory: createInitialConversationHistory()
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
          socket.emit('speech-request', { text: welcomeMessage });
          
          // 音声合成の開始後、さらに遅延させてから音声認識開始の準備完了通知を送信
          setTimeout(() => {
            // 音声認識がすぐに開始されるように通知（継続リスニングモードを有効化）
            socket.emit('ready-for-next-input', { status: 'ready', keep_listening: true });
          }, 2000); // 音声合成開始から2秒後
        }, 500);  // UI更新から0.5秒後
      }, 2000);  // 接続から2秒後

      /**
       * ユーザーからの音声認識テキスト受信イベントハンドラー
       * クライアントから送信された音声認識結果を処理
       * 
       * @param {string} text - 音声認識されたテキスト
       */
      socket.on('user-speech', text => {
        // 連続した同じメッセージや短すぎるメッセージは処理しない（無音や認識エラー対策）
        if (!text || text.trim().length < 2) {
          // 音声認識を継続させる
          socket.emit('ready-for-next-input', { status: 'ready', keep_listening: true });
          return;
        }
        
        // プロセス中なら新しいリクエストは無視するが、リスニングは継続（応答中の発話対策）
        if (clientState.isProcessing) {
          console.log('既に処理中のため、新しいリクエストを無視します:', text);
          // 音声認識は継続させる
          socket.emit('ready-for-next-input', { status: 'ready', keep_listening: true });
          return;
        }
        
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
        
        /**
         * ユーザー音声テキストの処理関数
         * テキストをGemini APIに送信し、応答を生成
         * 
         * @param {string} text - 処理するテキスト
         */
        async function processUserSpeech(text) {
          console.log('ユーザー音声テキスト受信:', text);
          clientState.isProcessing = true;
          
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
              
              // 少し遅延してから音声合成リクエストを送信（UIが先に更新されるように）
              setTimeout(() => {
                socket.emit('speech-request', { text: aiResponse });
                
                // 最後の応答時間を記録
                clientState.lastResponseTime = Date.now();
                clientState.isProcessing = false;
                
                // 音声合成開始から十分な時間が経過した後に次の入力準備完了を通知
                console.log('音声合成開始、3秒後に次の入力準備完了信号を送信します');
                
                setTimeout(() => {
                  console.log('次の入力準備完了信号を送信します');
                  // 音声認識を継続するフラグを追加
                  socket.emit('ready-for-next-input', { status: 'ready', keep_listening: true });
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
            
            // 会話履歴からエラーになったユーザーメッセージを削除（再試行のため）
            if (clientState.conversationHistory.length > 1) {
              clientState.conversationHistory.pop();
            }
            
            // エラー時も次の入力を促す（音声認識は継続）
            socket.emit('ready-for-next-input', { status: 'ready', keep_listening: true });
          }
        }
      });

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
        socket.emit('ready-for-next-input', { status: 'ready', error: true, keep_listening: true });
      });

      /**
       * クライアントからのピンポン（接続確認）イベントハンドラー
       * クライアントの接続状態を確認するためのシンプルな応答
       */
      socket.on('ping', () => {
        socket.emit('pong', { time: Date.now() });
      });

      /**
       * クライアント切断イベントハンドラー
       * クライアントが切断した際の処理
       */
      socket.on('disconnect', () => {
        console.log('クライアント切断:', socket.id);
      });
    });

    console.log('Socket.IOルートハンドラーの処理を完了しました');
    res.end();
  } catch (error) {
    // Socket.IOサーバーの初期化エラー処理
    console.error('Socket.IOサーバー初期化エラー:', error);
    res.status(500).end();
  }
} 