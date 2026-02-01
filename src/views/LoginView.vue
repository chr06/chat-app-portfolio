<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const isLoading = ref(false)
const errorMessage = ref('')

async function handleGoogleLogin() {
  isLoading.value = true
  errorMessage.value = ''

  try {
    await authStore.signInWithGoogle()
    // リダイレクトはルーターガードが処理
    if (authStore.isApproved) {
      router.push({ name: 'chat' })
    } else {
      router.push({ name: 'pending' })
    }
  } catch (error) {
    errorMessage.value = 'ログインに失敗しました。もう一度お試しください。'
    console.error('Login error:', error)
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-100 px-4">
    <div class="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
      <!-- ロゴ/タイトル -->
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-slack-purple">Chat App</h1>
        <p class="mt-2 text-gray-600">Slack風チャットアプリ</p>
      </div>

      <!-- 説明文 -->
      <p class="text-center text-gray-500 mb-8">
        このアプリは招待制です。<br />
        ログイン後、管理者の承認をお待ちください。
      </p>

      <!-- エラーメッセージ -->
      <div
        v-if="errorMessage"
        class="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm"
      >
        {{ errorMessage }}
      </div>

      <!-- Google ログインボタン -->
      <button
        :disabled="isLoading"
        class="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slack-purple disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        @click="handleGoogleLogin"
      >
        <!-- Google アイコン -->
        <svg class="w-5 h-5" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        <span v-if="!isLoading">Googleでログイン</span>
        <span v-else>ログイン中...</span>
      </button>
    </div>
  </div>
</template>
