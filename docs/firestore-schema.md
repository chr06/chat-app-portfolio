# Firestore データベース スキーマ

このドキュメントでは、チャットアプリで使用する Firestore のコレクション構造を定義します。

## コレクション構造

```
firestore/
├── users/{uid}
│   ├── uid: string
│   ├── displayName: string
│   ├── photoURL: string
│   ├── status: 'pending' | 'approved' | 'rejected'
│   ├── isTestUser?: boolean
│   ├── invitedBy?: string
│   ├── workspaceId?: string
│   ├── createdAt: Timestamp
│   └── updatedAt: Timestamp
│
├── invitations/{code}
│   ├── code: string
│   ├── inviterUid: string
│   ├── inviteeUid: string | null
│   ├── status: 'pending' | 'accepted'
│   ├── createdAt: Timestamp
│   └── acceptedAt: Timestamp | null
│
└── conversations/{conversationId}
    ├── participants: string[]
    ├── participantDetails: { [uid]: { displayName, photoURL } }
    ├── lastMessage: { text, senderId, createdAt } | null
    ├── hiddenBy?: string[]
    ├── createdAt: Timestamp
    ├── updatedAt: Timestamp
    │
    └── messages/{messageId}  (サブコレクション)
        ├── senderId: string
        ├── text: string
        ├── imageUrl?: string
        ├── imagePath?: string
        ├── reactions: { [emoji]: string[] }
        └── createdAt: Timestamp
```

---

## コレクション詳細

### users

ユーザー情報を管理するコレクション。

| フィールド    | 型        | 必須 | 説明                                                      |
| ------------- | --------- | :--: | --------------------------------------------------------- |
| `uid`         | string    |  ✓   | Firebase Auth の UID                                      |
| `displayName` | string    |  ✓   | 表示名                                                    |
| `photoURL`    | string    |  ✓   | プロフィール画像 URL                                      |
| `status`      | string    |  ✓   | 承認状態: `pending` / `approved` / `rejected`             |
| `isTestUser`  | boolean   |      | テストユーザーフラグ（シード生成時のみ）                  |
| `invitedBy`   | string    |      | 招待元ユーザーの UID                                      |
| `workspaceId` | string    |      | 所属ワークスペースの ID（自動生成 or 招待元から引き継ぎ） |
| `createdAt`   | Timestamp |  ✓   | 作成日時                                                  |
| `updatedAt`   | Timestamp |  ✓   | 更新日時                                                  |

**注意:** `email` は Firestore に保存しません。必要な場合は `auth.currentUser.email` から取得してください。

**インデックス:**

- `status` (単一フィールド、自動作成)
- `workspaceId` + `status`（複合インデックス）

---

### invitations

招待コードを管理するコレクション。コード自体がドキュメントIDとなる。

| フィールド   | 型                | 必須 | 説明                                            |
| ------------ | ----------------- | :--: | ----------------------------------------------- |
| `code`       | string            |  ✓   | 8文字英数字コード（ドキュメントIDと同一）       |
| `inviterUid` | string            |  ✓   | 招待を作成したユーザーの UID                    |
| `inviteeUid` | string \| null    |  ✓   | 招待を受諾したユーザーの UID（未受諾時は null） |
| `status`     | string            |  ✓   | 状態: `pending` / `accepted`                    |
| `createdAt`  | Timestamp         |  ✓   | 作成日時                                        |
| `acceptedAt` | Timestamp \| null |  ✓   | 受諾日時（未受諾時は null）                     |

**インデックス（複合）:**

- `inviterUid` + `status`
- `inviteeUid` + `status`

---

### conversations

会話（チャットルーム）を管理するコレクション。

| フィールド           | 型          | 必須 | 説明                                  |
| -------------------- | ----------- | :--: | ------------------------------------- |
| `participants`       | string[]    |  ✓   | 参加者の UID 配列                     |
| `participantDetails` | map         |  ✓   | 参加者の詳細情報（非正規化）          |
| `lastMessage`        | map \| null |  ✓   | 最新メッセージ（非正規化）            |
| `hiddenBy`           | string[]    |      | 会話を非表示にしたユーザーの UID 配列 |
| `createdAt`          | Timestamp   |  ✓   | 作成日時                              |
| `updatedAt`          | Timestamp   |  ✓   | 更新日時                              |

**participantDetails の構造:**

```typescript
{
  [uid: string]: {
    displayName: string
    photoURL: string
  }
}
```

**lastMessage の構造:**

```typescript
{
  text: string
  senderId: string
  createdAt: Timestamp
}
```

**インデックス（複合）:**

- `participants` (array-contains) + `updatedAt` (DESC)

---

### conversations/{conversationId}/messages

メッセージを管理するサブコレクション。

| フィールド  | 型        | 必須 | 説明                             |
| ----------- | --------- | :--: | -------------------------------- |
| `senderId`  | string    |  ✓   | 送信者の UID                     |
| `text`      | string    |  ✓   | メッセージ本文                   |
| `imageUrl`  | string    |      | 画像の公開 URL                   |
| `imagePath` | string    |      | Storage 内のパス（削除用）       |
| `reactions` | map       |  ✓   | リアクション（絵文字 → UID配列） |
| `createdAt` | Timestamp |  ✓   | 送信日時                         |

**reactions の構造:**

```typescript
{
  [emoji: string]: string[]  // 例: { "👍": ["uid1", "uid2"], "❤️": ["uid3"] }
}
```

**インデックス:**

- `createdAt` (DESC)

---

## セキュリティルール

詳細は [`firestore.rules`](../firestore.rules) を参照してください。

| コレクション  | 読み取り                  | 作成                                 | 更新                                                                           |
| ------------- | ------------------------- | ------------------------------------ | ------------------------------------------------------------------------------ |
| users         | 認証済み                  | 自分のドキュメント or テストユーザー | 自分のドキュメント（status変更は招待経由の自動承認 pending→approved のみ許可） |
| invitations   | 認証済み                  | 承認済み（自分が招待者）             | 認証済み（pending→accepted、自分が受諾者）                                     |
| conversations | 承認済み + 参加者         | 承認済み + 参加者                    | 承認済み + 参加者                                                              |
| messages      | 承認済み + 親会話の参加者 | 承認済み + 親会話の参加者            | reactions のみ                                                                 |

---

## ワークスペースについて

ユーザーの可視範囲を制御します。

### 仕組み

- **招待なしでログイン** → 新しい `workspaceId`（8文字英数字）が自動生成される
- **招待リンク経由でログイン** → 招待者の `workspaceId` を引き継ぎ、同じワークスペースに参加
- **既存ユーザー**（ワークスペース機能追加前に作成）→ ログイン時に `workspaceId` が未設定であれば自動生成

### ユーザーの可視性

新規メッセージダイアログなどでのユーザー一覧は以下の条件で表示されます：

1. **同じワークスペースの承認済みユーザー**（`workspaceId` が一致 かつ `status == 'approved'`）
2. **テストユーザー**（`isTestUser == true`）— ワークスペースに依存せず全ユーザーから参照可能

### 制約

- ユーザーは1つのワークスペースにのみ所属
- ワークスペースの管理UI（名前変更、ロール管理など）は未実装
- 会話はワークスペースにスコープされない（既存の `participants` ベースで制御）

---

## 非正規化について

読み取り回数を削減するため、以下のデータを非正規化しています：

1. **participantDetails** - 会話一覧表示時にユーザードキュメントを別途取得しなくて済む
2. **lastMessage** - 会話一覧で最新メッセージを表示するため

**更新タイミング:**

- `participantDetails`: 会話作成時に設定（ユーザー情報変更時の更新は未実装）
- `lastMessage`: メッセージ送信時に親会話ドキュメントを更新

---

## 関連ファイル

- 型定義: [`src/types/index.ts`](../src/types/index.ts)
- セキュリティルール: [`firestore.rules`](../firestore.rules)
- インデックス設定: [`firestore.indexes.json`](../firestore.indexes.json)
