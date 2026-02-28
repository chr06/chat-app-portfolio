import { ref, readonly } from 'vue'
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore'
import { db, auth } from '@/firebase/config'
import type { User } from '@/types'

export function useUsers() {
  const isSearching = ref(false)
  const searchError = ref<Error | null>(null)

  /**
   * 表示名でユーザーを検索（テストユーザー + 同ワークスペースユーザー）
   * 自分自身は除外
   */
  async function searchUsersByDisplayName(name: string): Promise<User[]> {
    if (!name.trim()) return []

    isSearching.value = true
    searchError.value = null

    try {
      const allVisibleUsers = await getApprovedUsers()

      const searchTerm = name.trim().toLowerCase()
      const filtered = allVisibleUsers.filter((user) =>
        user.displayName.toLowerCase().includes(searchTerm),
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
   * 表示可能なユーザー一覧を取得
   * テストユーザー + 同ワークスペースの承認済みユーザー
   * 自分自身は除外
   */
  async function getApprovedUsers(): Promise<User[]> {
    isSearching.value = true
    searchError.value = null

    try {
      const currentUser = auth.currentUser
      if (!currentUser) return []

      // NOTE: テストユーザーを取得
      const usersRef = collection(db, 'users')
      const testQuery = query(usersRef, where('isTestUser', '==', true))
      const testSnapshot = await getDocs(testQuery)
      const testUsers = testSnapshot.docs.map((d) => ({ uid: d.id, ...d.data() }) as User)

      // NOTE: 現在のユーザーのワークスペースIDを取得
      const currentUserDoc = await getDoc(doc(db, 'users', currentUser.uid))
      const currentWorkspaceId = currentUserDoc.exists()
        ? (currentUserDoc.data().workspaceId as string | undefined)
        : undefined

      // NOTE: 同ワークスペースの承認済みユーザーを取得
      let workspaceUsers: User[] = []
      if (currentWorkspaceId) {
        const wsQuery = query(
          usersRef,
          where('workspaceId', '==', currentWorkspaceId),
          where('status', '==', 'approved'),
        )
        const wsSnapshot = await getDocs(wsQuery)
        workspaceUsers = wsSnapshot.docs.map((d) => ({ uid: d.id, ...d.data() }) as User)
      }

      // NOTE: 重複排除して結合、自分を除外
      const allUsersMap = new Map<string, User>()
      for (const user of [...testUsers, ...workspaceUsers]) {
        if (user.uid !== currentUser.uid) {
          allUsersMap.set(user.uid, user)
        }
      }

      return Array.from(allUsersMap.values()).sort((a, b) =>
        a.displayName.localeCompare(b.displayName, 'ja'),
      )
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
