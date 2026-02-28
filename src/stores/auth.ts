import { defineStore } from 'pinia'
import { useAuth } from '@/composables/useAuth'

export const useAuthStore = defineStore('auth', () => {
  const {
    user,
    userProfile,
    isLoading,
    error,
    isAuthenticated,
    isApproved,
    isPending,
    init,
    signInWithGoogle,
    refreshProfile,
    signOut,
    cleanup,
  } = useAuth()

  return {
    // 状態
    user,
    userProfile,
    isLoading,
    error,

    // Computed
    isAuthenticated,
    isApproved,
    isPending,

    // メソッド
    init,
    signInWithGoogle,
    refreshProfile,
    signOut,
    cleanup,
  }
})
