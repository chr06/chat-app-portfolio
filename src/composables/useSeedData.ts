import { ref } from 'vue'
import { doc, setDoc, getDoc, collection, query, where, getDocs, limit, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { TEST_USERS_SEED_DATA } from '@/config/testUsers'

// シード済みかどうかのフラグ（アプリ起動中の重複実行を防ぐ）
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
      let created = 0
      let skipped = 0

      for (const [index, userData] of TEST_USERS_SEED_DATA.entries()) {
        // UIDは固定（test_user_1, test_user_2, ...）
        const uid = `test_user_${index + 1}`
        const userRef = doc(db, 'users', uid)

        // ドキュメントIDで既存チェック（インデックス不要）
        const existingDoc = await getDoc(userRef)

        if (existingDoc.exists()) {
          console.log(`スキップ: ${userData.displayName} (既存)`)
          skipped++
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

        console.log(`作成: ${userData.displayName}`)
        created++
      }

      seedMessage.value = `完了: ${created}件作成, ${skipped}件スキップ`
      console.log(seedMessage.value)
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
    // 既にチェック済みならスキップ
    if (hasCheckedSeed) {
      return
    }
    hasCheckedSeed = true

    try {
      // テストユーザーが1件でも存在するかチェック
      const usersRef = collection(db, 'users')
      const q = query(
        usersRef,
        where('isTestUser', '==', true),
        limit(1)
      )
      const snapshot = await getDocs(q)

      if (snapshot.empty) {
        console.log('[AutoSeed] テストユーザーが存在しません。シードを実行します...')
        await seedTestUsers()
      } else {
        console.log('[AutoSeed] テストユーザーは既に存在します')
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

// 開発コンソールから実行できるようにグローバルに公開
if (import.meta.env.DEV) {
  // @ts-ignore
  window.seedTestUsers = async () => {
    const { seedTestUsers } = useSeedData()
    await seedTestUsers()
  }
}
