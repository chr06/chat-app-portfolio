<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { RouterView } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useSeedData } from '@/composables/useSeedData'

const authStore = useAuthStore()
const { isLoading, isAuthenticated } = storeToRefs(authStore)
const { seedTestUsers, autoSeedIfNeeded } = useSeedData()

// 開発環境でシード関数をグローバルに公開
if (import.meta.env.DEV) {
  // @ts-ignore
  window.seedTestUsers = seedTestUsers
}

// ユーザーがログインしたらテストユーザーを自動シード
watch(isAuthenticated, (authenticated) => {
  if (authenticated) {
    autoSeedIfNeeded()
  }
})

onMounted(() => {
  authStore.init()
})

onUnmounted(() => {
  authStore.cleanup()
})
</script>

<template>
  <!-- ローディング中 -->
  <div v-if="isLoading" class="min-h-screen bg-gray-100 flex items-center justify-center">
    <div class="flex flex-col items-center gap-4">
      <!-- スピナー -->
      <div
        class="w-10 h-10 border-4 border-slack-purple border-t-transparent rounded-full animate-spin"
      />
      <p class="text-gray-500">読み込み中...</p>
    </div>
  </div>

  <!-- ルーターによる画面表示 -->
  <RouterView v-else />
</template>
