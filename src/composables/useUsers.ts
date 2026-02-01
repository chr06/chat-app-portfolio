import { ref, readonly } from 'vue'
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  getDoc,
  doc,
  limit,
} from 'firebase/firestore'
import { db, auth } from '@/firebase/config'
import type { User } from '@/types'

export function useUsers() {
  const isSearching = ref(false)
  const searchError = ref<Error | null>(null)

  /**
   * 表示名でテストユーザーを検索（前方一致）
   * ポートフォリオ用に、テストユーザーのみが検索対象
   * 自分自身は除外
   */
  async function searchUsersByDisplayName(name: string): Promise<User[]> {
    if (!name.trim()) return []

    isSearching.value = true
    searchError.value = null

    try {
      // テストユーザー全員を取得してクライアント側でフィルタリング
      // （Firestoreの複合クエリ制限を回避するため）
      const allTestUsers = await getApprovedUsers()

      const searchTerm = name.trim().toLowerCase()
      const filtered = allTestUsers.filter((user) =>
        user.displayName.toLowerCase().includes(searchTerm)
      )

      return filtered
    } catch (e) {
      searchError.value = e as Error
      console.error('Error searching users:', e)
      return []
    } finally {
      isSearching.value = false
    }
  }

  /**
   * テストユーザー一覧を取得
   * ポートフォリオ用に、テストユーザーのみが表示される
   * 自分自身は除外
   */
  async function getApprovedUsers(): Promise<User[]> {
    isSearching.value = true
    searchError.value = null

    try {
      const usersRef = collection(db, 'users')
      // isTestUserのみでクエリし、残りはクライアント側でフィルタ
      // （複合インデックスなしで動作させるため）
      const q = query(
        usersRef,
        where('isTestUser', '==', true)
      )

      console.log('[useUsers] クエリ実行中...')
      const snapshot = await getDocs(q)
      console.log('[useUsers] 取得件数:', snapshot.docs.length)

      const allUsers = snapshot.docs.map((doc) => {
        const data = doc.data()
        console.log('[useUsers] ユーザー:', doc.id, data)
        return { uid: doc.id, ...data } as User
      })

      const users = allUsers
        .filter((user) =>
          user.status === 'approved' &&
          user.uid !== auth.currentUser?.uid
        )
        .sort((a, b) => a.displayName.localeCompare(b.displayName, 'ja'))

      console.log('[useUsers] フィルタ後:', users.length, '件')
      return users
    } catch (e) {
      searchError.value = e as Error
      console.error('[useUsers] エラー:', e)
      return []
    } finally {
      isSearching.value = false
    }
  }

  /**
   * UIDでユーザーを取得
   */
  async function getUserById(uid: string): Promise<User | null> {
    try {
      const userRef = doc(db, 'users', uid)
      const userDoc = await getDoc(userRef)

      if (!userDoc.exists()) return null

      return { uid: userDoc.id, ...userDoc.data() } as User
    } catch (e) {
      console.error('Error fetching user:', e)
      return null
    }
  }

  return {
    isSearching: readonly(isSearching),
    searchError: readonly(searchError),
    searchUsersByDisplayName,
    getApprovedUsers,
    getUserById,
  }
}
