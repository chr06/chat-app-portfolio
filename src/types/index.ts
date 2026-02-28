import type { Timestamp } from 'firebase/firestore'

// ユーザーの承認状態
export type UserStatus = 'pending' | 'approved' | 'rejected'

// ユーザー（Firestoreに保存するデータ）
// 注意: emailはFirestoreに保存せず、Firebase Authenticationで管理
// emailが必要な場合は auth.currentUser.email から取得
export interface User {
  uid: string
  displayName: string
  photoURL: string
  status: UserStatus
  isTestUser?: boolean // シードされたテストユーザーかどうか
  invitedBy?: string // 招待元ユーザーのUID
  workspaceId?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

// Firebase Authから取得するユーザー情報（表示用）
export interface AuthUser {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
}

// 参加者の詳細情報（非正規化用）
export interface ParticipantDetail {
  displayName: string
  photoURL: string
}

// 最終メッセージ（非正規化用）
export interface LastMessage {
  text: string
  senderId: string
  createdAt: Timestamp
}

// 会話
export interface Conversation {
  id: string
  participants: string[]
  participantDetails: Record<string, ParticipantDetail>
  lastMessage: LastMessage | null
  hiddenBy?: string[] // 非表示にしたユーザーのUID配列
  createdAt: Timestamp
  updatedAt: Timestamp
}

// リアクション（絵文字 => UID配列）
export type Reactions = Record<string, string[]>

// メッセージ
export interface Message {
  id: string
  senderId: string
  text: string
  imageUrl?: string
  imagePath?: string
  reactions: Reactions
  createdAt: Timestamp
}

export type InvitationStatus = 'pending' | 'accepted'

export interface Invitation {
  code: string
  inviterUid: string // 招待作成者のUID
  inviteeUid: string | null // 招待受諾者のUID（受諾前はnull）
  status: InvitationStatus
  createdAt: Timestamp
  acceptedAt: Timestamp | null
}

// Firestoreドキュメントから取得したデータにIDを付与するユーティリティ型
export type WithId<T> = T & { id: string }

// 新規作成時の型（id, createdAt, updatedAtを除外）
export type CreateUser = Omit<User, 'createdAt' | 'updatedAt'>
export type CreateConversation = Omit<Conversation, 'id' | 'createdAt' | 'updatedAt'>
export type CreateMessage = Omit<Message, 'id' | 'createdAt'>
