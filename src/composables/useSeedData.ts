import { ref } from 'vue'
import {
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  limit,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import { TEST_USERS_SEED_DATA } from '@/config/testUsers'

let hasCheckedSeed = false

export function useSeedData() {
  const isSeeding = ref(false)
  const seedError = ref<Error | null>(null)
  const seedMessage = ref('')

  /**
   * テストユーザーをFirestoreにシードする
   * 既存のテストユーザーはスキップ
   */
  async function seedTestUsers(): Promise<void> {
    isSeeding.value = true
    seedError.value = null
    seedMessage.value = ''

    try {
      for (const [index, userData] of TEST_USERS_SEED_DATA.entries()) {
        const uid = `test_user_${index + 1}`
        const userRef = doc(db, 'users', uid)

        const existingDoc = await getDoc(userRef)

        if (existingDoc.exists()) {
          continue
        }

        await setDoc(userRef, {
          uid,
          displayName: userData.displayName,
          photoURL: userData.photoURL,
          status: 'approved',
          isTestUser: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      }
    } catch (e) {
      seedError.value = e as Error
      console.error('シードエラー:', e)
      seedMessage.value = `エラー: ${(e as Error).message}`
    } finally {
      isSeeding.value = false
    }
  }

  /**
   * テストユーザーが存在しない場合のみシードを実行
   * アプリ起動時に自動で呼び出される
   */
  async function autoSeedIfNeeded(): Promise<void> {
    if (hasCheckedSeed) {
      return
    }
    hasCheckedSeed = true

    try {
      const usersRef = collection(db, 'users')
      const q = query(usersRef, where('isTestUser', '==', true), limit(1))
      const snapshot = await getDocs(q)

      if (snapshot.empty) {
        await seedTestUsers()
      }
    } catch (e) {
      console.error('[AutoSeed] チェック中にエラー:', e)
      // エラーでも続行（ユーザー体験を妨げない）
    }
  }

  return {
    isSeeding,
    seedError,
    seedMessage,
    seedTestUsers,
    autoSeedIfNeeded,
  }
}

// NOTE: 開発コンソールから実行できるようにグローバルに公開
if (import.meta.env.DEV) {
  // @ts-expect-error グローバルに公開
  window.seedTestUsers = async () => {
    const { seedTestUsers } = useSeedData()
    await seedTestUsers()
  }
}
