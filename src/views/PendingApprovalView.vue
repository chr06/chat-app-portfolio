<script setup lang="ts">
import { watch } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { mdiClockOutline } from '@mdi/js'
import { useAuthStore } from '@/stores/auth'
import MdiIcon from '@/components/common/MdiIcon.vue'

const router = useRouter()
const authStore = useAuthStore()
const { user, userProfile, isApproved } = storeToRefs(authStore)

// 承認状態を監視し、承認されたらリダイレクト
watch(isApproved, (approved) => {
  if (approved) {
    router.push({ name: 'chat' })
  }
})

async function handleLogout() {
  await authStore.signOut()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-100 px-4">
    <div class="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
      <!-- 待機アイコン -->
      <div class="mb-6">
        <div
          class="mx-auto w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center"
        >
<MdiIcon :path="mdiClockOutline" :size="32" class="text-yellow-600" />
        </div>
      </div>

      <!-- タイトル -->
      <h1 class="text-2xl font-bold text-gray-900 mb-2">承認待ち</h1>

      <!-- 説明文 -->
      <p class="text-gray-600 mb-6">
        アカウントは現在、管理者の承認待ちです。<br />
        承認されるまでしばらくお待ちください。
      </p>

      <!-- ユーザー情報 -->
      <div
        v-if="userProfile || user"
        class="mb-6 p-4 bg-gray-50 rounded-md"
      >
        <div class="flex items-center gap-3">
          <img
            v-if="user?.photoURL"
            :src="user.photoURL"
            alt="Profile"
            class="w-10 h-10 rounded-full"
          />
          <div class="text-left">
            <p class="font-medium text-gray-800">
              {{ userProfile?.displayName || user?.displayName }}
            </p>
            <p class="text-sm text-gray-500">{{ user?.email }}</p>
          </div>
        </div>
      </div>

      <!-- ヒント -->
      <p class="text-sm text-gray-500 mb-6">
        承認されると、自動的にチャット画面に移動します。
      </p>

      <!-- ログアウトボタン -->
      <button
        class="w-full px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
        @click="handleLogout"
      >
        ログアウト
      </button>
    </div>
  </div>
</template>
