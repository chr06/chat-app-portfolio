import { ref, computed, readonly } from 'vue'
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  type User as FirebaseUser,
} from 'firebase/auth'
import { doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/firebase/config'
import type { User } from '@/types'

// NOTE: ワークスペースID生成用の文字セット（読み間違いやすい文字を除外）
const WS_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const WS_ID_LENGTH = 8

function generateWorkspaceId(): string {
  const array = new Uint8Array(WS_ID_LENGTH)
  crypto.getRandomValues(array)
  let id = ''
  for (let i = 0; i < WS_ID_LENGTH; i++) {
    id += WS_CHARS[array[i]! % WS_CHARS.length]
  }
  return id
}

export function useAuth() {
  const firebaseUser = ref<FirebaseUser | null>(null)
  const userProfile = ref<User | null>(null)
  const isLoading = ref(true)
  const error = ref<Error | null>(null)

  let unsubscribeAuth: (() => void) | null = null
  let unsubscribeProfile: (() => void) | null = null

  const isAuthenticated = computed(() => !!firebaseUser.value)
  const isApproved = computed(() => userProfile.value?.status === 'approved')
  const isPending = computed(() => userProfile.value?.status === 'pending')

  function init() {
    unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      firebaseUser.value = user

      if (unsubscribeProfile) {
        unsubscribeProfile()
        unsubscribeProfile = null
      }

      if (user) {
        const userRef = doc(db, 'users', user.uid)
        unsubscribeProfile = onSnapshot(
          userRef,
          (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.data()
              userProfile.value = {
                uid: snapshot.id,
                ...data,
              } as User

              // Note: 既存ユーザーにworkspaceIdが未設定の場合、自動生成して設定 （既存ユーザーの後方互換対応）
              if (!data.workspaceId) {
                updateDoc(userRef, {
                  workspaceId: generateWorkspaceId(),
                  updatedAt: serverTimestamp(),
                }).catch((err) => {
                  console.error('Failed to auto-assign workspaceId:', err)
                })
              }
            } else {
              userProfile.value = null
            }
            isLoading.value = false
          },
          (err) => {
            error.value = err
            isLoading.value = false
          },
        )
      } else {
        userProfile.value = null
        isLoading.value = false
      }
    })
  }

  async function signInWithGoogle() {
    try {
      error.value = null
      const provider = new GoogleAuthProvider()
      const result = await signInWithPopup(auth, provider)

      const userRef = doc(db, 'users', result.user.uid)
      const userDoc = await getDoc(userRef)

      if (!userDoc.exists()) {
        await setDoc(userRef, {
          uid: result.user.uid,
          displayName: result.user.displayName || 'ユーザー',
          photoURL: result.user.photoURL || '',
          status: 'pending',
          workspaceId: generateWorkspaceId(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      }
    } catch (e) {
      error.value = e as Error
      throw e
    }
  }

  // Note: Firestoreからプロフィールを再取得してストアを即座に更新 （招待受諾後の状態反映用）
  async function refreshProfile() {
    const currentUser = auth.currentUser
    if (!currentUser) return

    const userRef = doc(db, 'users', currentUser.uid)
    const snapshot = await getDoc(userRef)
    if (snapshot.exists()) {
      userProfile.value = { uid: snapshot.id, ...snapshot.data() } as User
    }
  }

  async function signOut() {
    try {
      await firebaseSignOut(auth)
    } catch (e) {
      error.value = e as Error
      throw e
    }
  }

  function cleanup() {
    if (unsubscribeAuth) unsubscribeAuth()
    if (unsubscribeProfile) unsubscribeProfile()
  }

  return {
    user: readonly(firebaseUser),
    userProfile: readonly(userProfile),
    isLoading: readonly(isLoading),
    error: readonly(error),
    isAuthenticated,
    isApproved,
    isPending,
    init,
    signInWithGoogle,
    refreshProfile,
    signOut,
    cleanup,
  }
}
