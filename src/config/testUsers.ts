/**
 * テストユーザー設定
 * ポートフォリオデモ用に、これらのユーザーのみがアプリを使用できます
 */

export interface TestUser {
  uid: string
  email: string
  displayName: string
  photoURL: string
}

// テストユーザー一覧
// 実際のGoogleアカウントのメールアドレスに置き換えてください
export const TEST_USER_EMAILS: string[] = [
  'test1@example.com',
  'test2@example.com',
  'test3@example.com',
  'test4@example.com',
  'test5@example.com',
]

// デモ用のテストユーザーデータ（Firestoreシード用）
export const TEST_USERS_SEED_DATA: Omit<TestUser, 'uid'>[] = [
  {
    email: 'test1@example.com',
    displayName: 'テストユーザー1',
    photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=test1',
  },
  {
    email: 'test2@example.com',
    displayName: 'テストユーザー2',
    photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=test2',
  },
  {
    email: 'test3@example.com',
    displayName: 'テストユーザー3',
    photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=test3',
  },
  {
    email: 'test4@example.com',
    displayName: 'テストユーザー4',
    photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=test4',
  },
  {
    email: 'test5@example.com',
    displayName: 'テストユーザー5',
    photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=test5',
  },
]

/**
 * テストユーザーかどうかを判定
 */
export function isTestUser(email: string | null | undefined): boolean {
  if (!email) return false
  return TEST_USER_EMAILS.includes(email.toLowerCase())
}
