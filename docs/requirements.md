# Slack風チャットアプリ MVP 要件定義書

## 📌 プロジェクト概要

### プロジェクト名
ChatVue（仮称）

### 目的
- ポートフォリオとして公開するSlack風チャットアプリケーションの開発
- GitHub Publicプロジェクトとして公開
- デモURLをGitHubプロフィールで公開

### ターゲットユーザー
- 申請制で許可されたユーザーのみ（想定利用者数：10人）
- 管理者：開発者本人1名

---

## 🛠️ 技術スタック

### フロントエンド
| 技術 | バージョン | 用途 |
|------|-----------|------|
| Vite | ^5.0.0 | ビルドツール |
| Vue 3 | ^3.4.0 | UIフレームワーク |
| TypeScript | ^5.3.0 | 型安全性 |
| Composition API | - | コンポーネント設計 |
| Tailwind CSS | ^3.4.0 | スタイリング |
| browser-image-compression | ^2.0.2 | 画像圧縮 |

### バックエンド（Firebase）
| サービス | 用途 |
|----------|------|
| Firebase Authentication | Google認証 |
| Firestore | データベース |
| Firebase Storage | 画像ストレージ |
| Firebase Hosting | デプロイ先 |

### その他
- **バージョン管理**: Git / GitHub（Public）
- **デプロイ**: Firebase Hosting（自動デプロイ予定）

---

## ✅ 機能要件

### 1. 認証・承認システム
- [ ] Googleアカウントでのログイン
- [ ] 新規ユーザーは「承認待ち」状態で登録
- [ ] 管理者がFirestoreで手動承認（status: 'approved'）
- [ ] 承認済みユーザーのみチャット画面にアクセス可能
- [ ] 未承認ユーザーには承認待ち画面を表示

### 2. ユーザー管理
- [ ] ユーザープロフィール表示（名前・アイコン）
- [ ] 表示名の編集機能
- [ ] ユーザー検索（表示名で検索 + 一覧から選択）

### 3. ダイレクトメッセージ（DM）
- [ ] 1対1のプライベートチャット
- [ ] リアルタイムメッセージ送受信
- [ ] テキストメッセージ送信
- [ ] 画像送信（最大5MB、画像形式のみ）
- [ ] 無限スクロール（20件ずつ取得）
- [ ] 会話リスト表示
- [ ] 最終メッセージのプレビュー表示

### 4. リアクション機能
- [ ] メッセージへの絵文字リアクション（👍❤️😀😢😮🎉）
- [ ] 誰がリアクションしたか表示
- [ ] リアクションの追加・削除

### 5. 検索機能
- [ ] ユーザー検索（表示名で前方一致検索）
- [ ] メッセージ検索（完全一致）※MVP後に全文検索対応予定

### セキュリティ考慮事項
- メールアドレスはFirestoreに保存せず、Firebase Authenticationでのみ管理
- ユーザー検索は表示名ベースで実装（プライバシー保護）

### 6. レスポンシブ対応
- [ ] PC対応（1024px以上）
- [ ] タブレット対応（768px〜1023px）
- [ ] スマートフォン対応（767px以下）

### 将来的に追加予定（MVP外）
- チャンネル機能（複数人参加型）
- スレッド機能
- オンライン状態表示
- ブラウザ通知機能
- メッセージ検索の全文検索対応（Algoliaなど外部サービス）
- メッセージの編集・削除

---

## 🗄️ データベース設計（Firestore）

### コレクション構造

```typescript
// ============================================
// users コレクション
// ============================================
// パス: users/{uid}
// 注意: emailはFirestoreに保存せず、Firebase Authenticationで管理
interface User {
  uid: string                    // ドキュメントID（Auth UIDと同一）
  displayName: string            // 表示名
  photoURL: string               // プロフィール画像URL
  status: 'pending' | 'approved' | 'rejected'  // 承認状態
  createdAt: Timestamp           // 作成日時
  updatedAt: Timestamp           // 更新日時
}
// emailはFirebase Authentication（auth.currentUser.email）から取得

// ============================================
// conversations コレクション
// ============================================
// パス: conversations/{conversationId}
interface Conversation {
  id: string                     // ドキュメントID（自動生成）
  participants: string[]         // 参加者のUID配列（検索用）
  participantDetails: {          // 参加者の詳細情報（表示用・非正規化）
    [uid: string]: {
      displayName: string
      photoURL: string
    }
  }
  lastMessage: {                 // 最終メッセージ（プレビュー用・非正規化）
    text: string
    senderId: string
    createdAt: Timestamp
  } | null
  createdAt: Timestamp           // 作成日時
  updatedAt: Timestamp           // 最終更新日時（並び替え用）
}

// ============================================
// messages サブコレクション
// ============================================
// パス: conversations/{conversationId}/messages/{messageId}
interface Message {
  id: string                     // メッセージID（自動生成）
  senderId: string               // 送信者UID
  text: string                   // メッセージ本文
  imageUrl?: string              // 画像URL（オプション）
  imagePath?: string             // Storage内のパス（削除用）
  reactions: {                   // リアクション
    [emoji: string]: string[]    // 絵文字 => リアクションしたユーザーのUID配列
  }
  createdAt: Timestamp           // 送信日時
}
```

### インデックス設定

```json
// firestore.indexes.json
{
  "indexes": [
    {
      "collectionGroup": "conversations",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "participants", "arrayConfig": "CONTAINS" },
        { "fieldPath": "updatedAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

**自動作成されるインデックス**:
- `messages`: `createdAt` (desc) - サブコレクション内での並び替え

---

## 🔐 セキュリティルール

### Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // 認証済みかチェック
    function isAuthenticated() {
      return request.auth != null;
    }

    // 承認済みユーザーかチェック
    function isApproved() {
      return isAuthenticated() &&
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.status == 'approved';
    }

    // 会話の参加者かチェック
    function isParticipant(conversationId) {
      return request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.participants;
    }

    // ============================================
    // users コレクション
    // ============================================
    match /users/{userId} {
      // 読み取り: 承認済みユーザーのみ
      allow read: if isApproved();

      // 作成: 認証済みで自分のドキュメントのみ
      allow create: if isAuthenticated() &&
                      request.auth.uid == userId &&
                      request.resource.data.status == 'pending';

      // 更新: 承認済みで自分のドキュメントのみ（statusは変更不可）
      allow update: if isApproved() &&
                      request.auth.uid == userId &&
                      request.resource.data.status == resource.data.status;
    }

    // ============================================
    // conversations コレクション
    // ============================================
    match /conversations/{conversationId} {
      // 読み取り: 承認済み＆参加者のみ
      allow read: if isApproved() &&
                    request.auth.uid in resource.data.participants;

      // 作成: 承認済み＆自分が参加者に含まれる
      allow create: if isApproved() &&
                      request.auth.uid in request.resource.data.participants &&
                      request.resource.data.participants.size() == 2;

      // 更新: 承認済み＆参加者のみ（lastMessageの更新用）
      allow update: if isApproved() &&
                      request.auth.uid in resource.data.participants;

      // ============================================
      // messages サブコレクション
      // ============================================
      match /messages/{messageId} {
        // 読み取り: 承認済み＆会話の参加者のみ
        allow read: if isApproved() && isParticipant(conversationId);

        // 作成: 承認済み＆参加者＆自分が送信者
        allow create: if isApproved() &&
                        isParticipant(conversationId) &&
                        request.resource.data.senderId == request.auth.uid;

        // 更新: 承認済み＆参加者のみ（リアクション用）
        allow update: if isApproved() && isParticipant(conversationId);
      }
    }
  }
}
```

### Firebase Storage Rules

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // 画像ファイルのみ許可
    function isImageFile() {
      return request.resource.contentType.matches('image/.*');
    }

    // ファイルサイズ制限（5MB）
    function isValidSize() {
      return request.resource.size < 5 * 1024 * 1024;
    }

    // ============================================
    // ユーザー画像フォルダ
    // ============================================
    match /images/{userId}/{fileName} {
      // 読み取り: 認証済みユーザー
      allow read: if request.auth != null;

      // 書き込み: 認証済み＆自分のフォルダ＆画像＆5MB以下
      allow write: if request.auth != null &&
                     request.auth.uid == userId &&
                     isImageFile() &&
                     isValidSize();

      // 削除: 認証済み＆自分のフォルダ
      allow delete: if request.auth != null &&
                      request.auth.uid == userId;
    }
  }
}
```

---

## 💰 Firebase無料枠対策

### 無料枠の制限

| リソース | 無料枠 | 備考 |
|----------|--------|------|
| Firestore読み取り | 50,000回/日 | |
| Firestore書き込み | 20,000回/日 | |
| Firestore削除 | 20,000回/日 | |
| Storage保存容量 | 5GB | |
| Storage転送量 | 1GB/日 | |
| Hosting保存容量 | 10GB | |
| Hosting転送量 | 360MB/日 | |

### 対策実装

1. **ページネーション**
   - 無限スクロールで20件ずつメッセージ取得
   - 会話リストも20件ずつ取得

2. **画像圧縮**
   - アップロード前にクライアント側で圧縮（browser-image-compression）
   - 最大幅: 1920px
   - 品質: 0.8

3. **非正規化**
   - 会話ドキュメントに`lastMessage`と`participantDetails`を保持
   - 追加のクエリを削減

4. **リアルタイムリスナーの最適化**
   - 必要な画面でのみリスナーを有効化
   - コンポーネントのアンマウント時に必ずクリーンアップ

5. **キャッシュ活用**
   - Firestoreのオフライン永続性を有効化
   - 可能な場合はキャッシュから読み取り

### 10人利用時の想定使用量（1日あたり）

| 操作 | 想定回数 | 読み取り | 書き込み |
|------|----------|----------|----------|
| ログイン | 10回 | 20回 | 0回 |
| 会話リスト表示 | 50回 | 1,000回 | 0回 |
| メッセージ読み込み | 100回 | 2,000回 | 0回 |
| メッセージ送信 | 200回 | 0回 | 400回 |
| リアクション | 100回 | 0回 | 100回 |
| **合計** | - | **約3,000回** | **約500回** |

→ 無料枠内で十分に運用可能

---

## 🎨 UI/UX要件

### デザイン原則
- Slackライクなインターフェース
- レスポンシブデザイン（PC・スマートフォン対応）
- Tailwind CSSを使用したクリーンなデザイン
- ダークモード対応（将来対応予定）

### レイアウト構成

#### PC版（1024px以上）
```
┌─────────────────────────────────────────────────────┐
│ Header (ロゴ・ユーザー情報・ログアウト)               │
├────────────┬────────────────────────────────────────┤
│            │                                        │
│  サイド    │     メッセージ表示エリア                │
│  バー      │     (無限スクロール)                    │
│            │                                        │
│  ・会話    │                                        │
│   リスト   │                                        │
│            │                                        │
│  ・新規DM  ├────────────────────────────────────────┤
│   ボタン   │  メッセージ入力欄 + 画像添付ボタン      │
│            │                                        │
└────────────┴────────────────────────────────────────┘
```

#### スマートフォン版（767px以下）
```
┌─────────────────────┐    ┌─────────────────────┐
│ Header              │    │ ← 戻る   相手の名前  │
├─────────────────────┤    ├─────────────────────┤
│                     │    │                     │
│  会話リスト          │ → │  メッセージ表示      │
│  (タップで詳細へ)    │    │                     │
│                     │    │                     │
│                     │    ├─────────────────────┤
│                     │    │ 入力欄              │
├─────────────────────┤    └─────────────────────┘
│ + 新規DM            │
└─────────────────────┘
```

### 画面一覧

| 画面名 | パス | 説明 |
|--------|------|------|
| ログイン画面 | `/login` | Googleログインボタン |
| 承認待ち画面 | `/pending` | 承認待ちメッセージ表示 |
| チャット画面 | `/chat` | メイン画面（会話リスト＋メッセージ） |
| チャット詳細 | `/chat/:conversationId` | 特定の会話のメッセージ表示 |

### カラーパレット（Tailwind CSS）

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
        },
        slack: {
          purple: '#4A154B',
          green: '#2BAC76',
          yellow: '#ECB22E',
          red: '#E01E5A',
          blue: '#36C5F0',
        }
      }
    }
  }
}
```

---

## 📁 ディレクトリ構成

```
chat-app-portfolio/
├── public/
│   └── favicon.ico
├── src/
│   ├── assets/
│   │   └── main.css                   # Tailwind CSS
│   ├── components/
│   │   ├── chat/
│   │   │   ├── ConversationList.vue   # 会話リスト
│   │   │   ├── ConversationItem.vue   # 会話アイテム
│   │   │   ├── MessageList.vue        # メッセージリスト
│   │   │   ├── MessageItem.vue        # メッセージアイテム
│   │   │   ├── MessageInput.vue       # メッセージ入力欄
│   │   │   └── ImagePreview.vue       # 画像プレビュー
│   │   ├── common/
│   │   │   ├── Avatar.vue             # アバター
│   │   │   ├── LoadingSpinner.vue     # ローディング
│   │   │   └── EmojiPicker.vue        # 絵文字ピッカー
│   │   ├── user/
│   │   │   ├── UserSearch.vue         # ユーザー検索
│   │   │   └── UserProfile.vue        # プロフィール編集
│   │   └── layout/
│   │       ├── AppHeader.vue          # ヘッダー
│   │       └── Sidebar.vue            # サイドバー
│   ├── composables/
│   │   ├── useAuth.ts                 # 認証ロジック
│   │   ├── useConversations.ts        # 会話管理
│   │   ├── useMessages.ts             # メッセージ管理
│   │   ├── useUsers.ts                # ユーザー管理
│   │   └── useImageUpload.ts          # 画像アップロード
│   ├── types/
│   │   └── index.ts                   # 型定義
│   ├── firebase/
│   │   └── config.ts                  # Firebase設定
│   ├── stores/
│   │   └── auth.ts                    # 認証ストア（Pinia）
│   ├── router/
│   │   └── index.ts                   # ルーティング設定
│   ├── views/
│   │   ├── LoginView.vue              # ログイン画面
│   │   ├── PendingApprovalView.vue    # 承認待ち画面
│   │   └── ChatView.vue               # チャット画面
│   ├── App.vue                        # ルートコンポーネント
│   └── main.ts                        # エントリーポイント
├── docs/
│   └── requirements.md                # 要件定義書（本ファイル）
├── .env.local                         # 環境変数（Firebase設定）※gitignore
├── .env.example                       # 環境変数サンプル
├── .firebaserc                        # Firebaseプロジェクト設定
├── firebase.json                      # Firebaseホスティング設定
├── firestore.rules                    # Firestoreセキュリティルール
├── firestore.indexes.json             # Firestoreインデックス
├── storage.rules                      # Storageセキュリティルール
├── tailwind.config.js                 # Tailwind設定
├── postcss.config.js                  # PostCSS設定
├── vite.config.ts                     # Vite設定
├── tsconfig.json                      # TypeScript設定
└── package.json                       # パッケージ設定
```

---

## 🚀 実装フェーズ

### Phase 1: セットアップ
- [ ] Firebase プロジェクト作成・設定
- [ ] 必要パッケージインストール（firebase, browser-image-compression）
- [ ] Tailwind CSS セットアップ
- [ ] Firebase設定ファイル作成
- [ ] 型定義ファイル作成
- [ ] 基本的なルーティング設定

### Phase 2: 認証・承認システム
- [ ] useAuth composable実装
- [ ] authストア実装（Pinia）
- [ ] Google認証実装
- [ ] ユーザー登録時にFirestoreへ保存（status: 'pending'）
- [ ] ログイン画面実装
- [ ] 承認待ち画面実装
- [ ] ルーターガード実装（承認済みユーザーのみアクセス可能）

### Phase 3: レイアウト・UI基盤
- [ ] AppHeader コンポーネント
- [ ] Sidebar コンポーネント
- [ ] Avatar コンポーネント
- [ ] LoadingSpinner コンポーネント
- [ ] ChatView 基本レイアウト

### Phase 4: 会話機能
- [ ] useConversations composable実装
- [ ] ConversationList コンポーネント
- [ ] ConversationItem コンポーネント
- [ ] UserSearch コンポーネント（DM開始用）
- [ ] 会話作成機能

### Phase 5: メッセージ機能
- [ ] useMessages composable実装
- [ ] MessageList コンポーネント
- [ ] MessageItem コンポーネント
- [ ] MessageInput コンポーネント
- [ ] 無限スクロール実装
- [ ] リアルタイム更新

### Phase 6: 画像送信機能
- [ ] useImageUpload composable実装
- [ ] ImagePreview コンポーネント
- [ ] 画像圧縮処理
- [ ] Storage アップロード

### Phase 7: リアクション機能
- [ ] EmojiPicker コンポーネント
- [ ] リアクション追加・削除機能
- [ ] リアクション表示

### Phase 8: レスポンシブ対応
- [ ] PC版レイアウト調整
- [ ] スマートフォン版レイアウト調整
- [ ] タブレット版レイアウト調整

### Phase 9: デプロイ・仕上げ
- [ ] Firestore セキュリティルール設定
- [ ] Storage セキュリティルール設定
- [ ] Firebase Hosting 設定
- [ ] 本番デプロイ
- [ ] 動作確認・バグ修正

---

## 📦 必要なパッケージ

```json
{
  "dependencies": {
    "vue": "^3.5.0",
    "vue-router": "^4.6.0",
    "pinia": "^3.0.0",
    "firebase": "^10.7.0",
    "browser-image-compression": "^2.0.2"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^6.0.0",
    "typescript": "~5.9.0",
    "vite": "^7.0.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  }
}
```

---

## 🎯 成功基準

### MVP完成の定義

| # | 基準 | 状態 |
|---|------|------|
| 1 | 承認されたユーザーのみログイン可能 | [ ] |
| 2 | ユーザー検索からDM開始可能 | [ ] |
| 3 | リアルタイムでメッセージ送受信可能 | [ ] |
| 4 | 画像送信が可能（5MB以下、圧縮あり） | [ ] |
| 5 | 絵文字リアクションが可能 | [ ] |
| 6 | PC・スマホ両方で動作 | [ ] |
| 7 | Firebase Hostingにデプロイ済み | [ ] |
| 8 | GitHub Publicリポジトリとして公開 | [ ] |
| 9 | 無料枠内で10人が利用可能 | [ ] |

---

## 📝 備考

### 制約事項
- 利用者は申請制で管理者が承認したユーザーのみ
- Firebase無料枠内での運用を前提
- 管理者機能（承認作業）はFirebase Console経由で手動実施

### 参考リンク
- [Firebase Documentation](https://firebase.google.com/docs)
- [Vue.js Documentation](https://vuejs.org/)
- [Tailwind CSS Documentation](https://tailwindcss.com/)
- [VueFire（参考）](https://vuefire.vuejs.org/)

---

## 📅 更新履歴

| 日付 | バージョン | 内容 |
|------|-----------|------|
| 2025-01-24 | 1.0.0 | 初版作成 |
