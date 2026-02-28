<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter, RouterView } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useSeedData } from '@/composables/useSeedData'
import { useInvitations } from '@/composables/useInvitations'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { isLoading, isAuthenticated } = storeToRefs(authStore)
const { seedTestUsers, autoSeedIfNeeded } = useSeedData()
const { acceptInvitation } = useInvitations()

// NOTE: 開発環境でシード関数をグローバルに公開
if (import.meta.env.DEV) {
  // @ts-ignore
  window.seedTestUsers = seedTestUsers
}

// NOTE: ユーザーがログインしたらテストユーザーを自動シード
watch(isAuthenticated, (authenticated) => {
  if (authenticated) {
    autoSeedIfNeeded()
  }
})

// NOTE: ログイン済みユーザーが招待リンクを開いた場合の自動受諾
watch(
  () => route.query.invite,
  async (inviteCode) => {
    if (inviteCode && isAuthenticated.value) {
      try {
        const accepted = await acceptInvitation(inviteCode as string)
        if (accepted) {
          await authStore.refreshProfile()
        }
      } catch (error) {
        console.error('Failed to accept invitation:', error)
      }
      router.replace({ name: authStore.isApproved ? 'chat' : 'pending' })
    }
  },
  { immediate: true },
)

onMounted(() => {
  authStore.init()
})

onUnmounted(() => {
  authStore.cleanup()
})
</script>

<template>
  <div v-if="isLoading" class="min-h-screen bg-gray-100 flex items-center justify-center">
    <div class="flex flex-col items-center gap-4">
      <div
        class="w-10 h-10 border-4 border-slack-purple border-t-transparent rounded-full animate-spin"
      />
      <p class="text-gray-500">読み込み中...</p>
    </div>
  </div>

  <RouterView v-else />
</template>
