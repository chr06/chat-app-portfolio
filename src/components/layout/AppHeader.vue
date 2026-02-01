<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { mdiMenu, mdiLogout } from '@mdi/js'
import { useAuthStore } from '@/stores/auth'
import Avatar from '@/components/common/Avatar.vue'
import MdiIcon from '@/components/common/MdiIcon.vue'

interface Emits {
  (e: 'toggle-sidebar'): void
}

const emit = defineEmits<Emits>()

const router = useRouter()
const authStore = useAuthStore()
const { userProfile } = storeToRefs(authStore)

async function handleLogout() {
  await authStore.signOut()
  router.push({ name: 'login' })
}
</script>

<template>
  <header
    class="fixed top-0 left-0 right-0 h-14 bg-slack-purple text-white flex items-center px-4 z-50"
  >
    <!-- モバイルメニューボタン -->
    <button
      class="lg:hidden p-2 hover:bg-white/10 rounded-md mr-2"
      aria-label="メニューを開く"
      @click="emit('toggle-sidebar')"
    >
      <MdiIcon :path="mdiMenu" :size="24" />
    </button>

    <!-- ロゴ -->
    <h1 class="text-xl font-bold">Chat App</h1>

    <!-- スペーサー -->
    <div class="flex-1" />

    <!-- ユーザー情報 -->
    <div class="flex items-center gap-3">
      <Avatar
        :src="userProfile?.photoURL"
        :name="userProfile?.displayName"
        size="sm"
        :show-border="false"
      />

      <!-- ログアウトボタン -->
      <button
        class="p-2 hover:bg-white/10 rounded-md"
        aria-label="ログアウト"
        title="ログアウト"
        @click="handleLogout"
      >
        <MdiIcon :path="mdiLogout" :size="24" />
      </button>
    </div>
  </header>
</template>
