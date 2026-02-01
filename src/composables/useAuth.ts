import { ref, computed, readonly } from 'vue'
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  type User as FirebaseUser,
} from 'firebase/auth'
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore'
import { auth, db } from '@/firebase/config'
import { isTestUser } from '@/config/testUsers'
import type { User } from '@/types'

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
              userProfile.value = {
                uid: snapshot.id,
                ...snapshot.data(),
              } as User
            } else {
              userProfile.value = null
            }
            isLoading.value = false
          },
          (err) => {
            error.value = err
            isLoading.value = false
          }
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

      const userEmail = result.user.email
      const isTest = isTestUser(userEmail)

      if (!userDoc.exists()) {
        // テストユーザーは自動承認、それ以外は承認待ち
        await setDoc(userRef, {
          uid: result.user.uid,
          displayName: result.user.displayName || 'ユーザー',
          photoURL: result.user.photoURL || '',
          status: isTest ? 'approved' : 'pending',
          isTestUser: isTest,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      } else if (isTest && userDoc.data()?.status !== 'approved') {
        // 既存のテストユーザーで未承認の場合は承認
        await setDoc(
          userRef,
          {
            status: 'approved',
            isTestUser: true,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        )
      }
    } catch (e) {
      error.value = e as Error
      throw e
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
    signOut,
    cleanup,
  }
}
