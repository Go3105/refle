# Refle

## 開発の手順書

このプロジェクトは共同開発で進めています。以下の手順に従って開発を行ってください。

### 1. リポジトリのクローン

```bash
git clone https://github.com/[ユーザー名]/refle.git
cd refle
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. 新しいブランチの作成

機能開発やバグ修正をする際は、必ず新しいブランチを作成してください。

```bash
# ブランチの命名規則:
# feature/[機能名] - 新機能の開発
# bugfix/[バグ名] - バグ修正
# docs/[ドキュメント名] - ドキュメント更新
# refactor/[リファクタリング内容] - コードリファクタリング
# voice/[機能名] - 音声関連機能
# hotfix/[修正内容] - 細かい修正


git checkout -b [ブランチ名]
```

例：
```bash
git checkout -b feature/login-page
```

### 4. 変更の作成とコミット

```bash
# 変更をステージングエリアに追加
git add .

# コミット
git commit -m "わかりやすいコミットメッセージ"
```

### 5. リモートリポジトリにプッシュ

```bash
git push origin [ブランチ名]
```

### 6. プルリクエストの作成

GitHub上でプルリクエストを作成してください。
1. リポジトリページにアクセス
2. 「Pull requests」タブを選択
3. 「New pull request」ボタンをクリック
4. ベースブランチ（通常は「main」）と作成したブランチを選択
5. 「Create pull request」をクリック
6. タイトルと説明を記入
7. 「Create pull request」をクリック

### 7. コードレビューと修正

他のメンバーによるコードレビューを受け、必要に応じて修正を行います。
修正後は再度コミットとプッシュを行ってください。

### 8. マージ

レビューが完了したら、プルリクエストをマージします。
1. プルリクエストページで「Merge pull request」をクリック
2. 「Confirm merge」をクリック

### 9. ローカルの同期

マージ後、ローカル環境を最新の状態に更新します。

```bash
git checkout main
git pull origin main
```

### 10. 不要なブランチの削除

マージ済みのブランチは削除します。

```bash
# ローカルブランチの削除
git branch -d [ブランチ名]

# リモートブランチの削除（必要な場合）
git push origin --delete [ブランチ名]
```

## 開発環境のセットアップ

### 必要な依存関係

プロジェクトを実行するには、以下の依存関係が必要です：

```bash
# 基本的な依存関係
npm install

# 音声機能のための追加依存関係
npm install elevenlabs
```

### 環境変数の設定

`.env.local`ファイルを作成し、以下の環境変数を設定してください：

```
# ElevenLabs APIキー（サーバーサイドのみ）
ELEVEN_LABS_API_KEY=あなたのAPIキーをここに設定してください
```

APIキーは[ElevenLabs](https://elevenlabs.io/)のアカウントから取得できます。

## プロジェクトの実行方法

開発サーバーを起動するには、以下のコマンドを実行してください：

```bash
npm run dev
```

ブラウザで `http://localhost:3000` にアクセスすると、アプリケーションが表示されます。