<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { mdiMagnify, mdiClose } from '@mdi/js'
import { useAuthStore } from '@/stores/auth'
import { useUsers } from '@/composables/useUsers'
import { useConversations } from '@/composables/useConversations'
import Avatar from '@/components/common/Avatar.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import MdiIcon from '@/components/common/MdiIcon.vue'
import type { User } from '@/types'

interface Emits {
  (e: 'close'): void
}

const emit = defineEmits<Emits>()

const router = useRouter()
const authStore = useAuthStore()
const { userProfile } = storeToRefs(authStore)

const { searchUsersByDisplayName, getApprovedUsers, isSearching } = useUsers()
const { getOrCreateConversation, conversations } = useConversations()

const searchQuery = ref('')
const searchResults = ref<User[]>([])
const approvedUsers = ref<User[]>([])
const isStartingChat = ref(false)

// 既に会話が存在するユーザーIDのセット
const existingConversationUserIds = computed(() => {
  if (!userProfile.value) return new Set<string>()

  const userIds = new Set<string>()
  for (const conv of conversations.value) {
    const otherUserId = conv.participants.find(id => id !== userProfile.value?.uid)
    if (otherUserId) {
      userIds.add(otherUserId)
    }
  }
  return userIds
})

onMounted(async () => {
  // 承認済みユーザー一覧を取得
  approvedUsers.value = await getApprovedUsers()
})

// 検索クエリが変更されたらリアルタイムで検索
watch(searchQuery, async (newQuery) => {
  if (newQuery.trim()) {
    searchResults.value = await searchUsersByDisplayName(newQuery)
  } else {
    searchResults.value = []
  }
})

async function startConversation(user: User) {
  if (!userProfile.value || isStartingChat.value) return

  isStartingChat.value = true

  try {
    const conversationId = await getOrCreateConversation(
      userProfile.value,
      user
    )
    emit('close')
    router.push({ name: 'conversation', params: { conversationId } })
  } catch (error) {
    console.error('Error starting conversation:', error)
  } finally {
    isStartingChat.value = false
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    emit('close')
  }
}

// 表示するユーザーリスト（検索中は検索結果、そうでなければ全ユーザー）
// 既に会話が存在するユーザーは除外
const displayUsers = computed(() => {
  const baseList = searchQuery.value.trim() ? searchResults.value : approvedUsers.value
  return baseList.filter(user => !existingConversationUserIds.value.has(user.uid))
})
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4"
    @keydown="handleKeydown"
  >
    <!-- オーバーレイ -->
    <div
      class="absolute inset-0 bg-black/50"
      @click="emit('close')"
    />

    <!-- モーダル -->
    <div
      class="relative bg-white rounded-lg shadow-xl w-full max-w-md max-h-[80vh] flex flex-col"
    >
      <!-- ヘッダー -->
      <div class="flex items-center justify-between p-4 border-b">
        <h2 class="text-lg font-semibold">新しいメッセージ</h2>
        <button
          class="p-2 hover:bg-gray-100 active:bg-gray-200 rounded-md min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="閉じる"
          @click="emit('close')"
        >
<MdiIcon :path="mdiClose" :size="20" />
        </button>
      </div>

      <!-- 検索フォーム -->
      <div class="p-4 border-b">
        <div class="relative">
<MdiIcon
            :path="mdiMagnify"
            :size="20"
            class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
          />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="名前で検索..."
            class="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slack-purple"
          />
        </div>
      </div>

      <!-- コンテンツ -->
      <div class="flex-1 overflow-y-auto p-4">
        <!-- ローディング -->
        <div v-if="isSearching" class="flex justify-center py-8">
          <LoadingSpinner />
        </div>

        <!-- ユーザー一覧 -->
        <template v-else>
          <div v-if="displayUsers.length > 0">
            <h3 class="text-sm font-medium text-gray-500 mb-2">
              {{ searchQuery.trim() ? '検索結果' : 'ユーザー一覧' }}
            </h3>
            <div class="space-y-1">
              <button
                v-for="user in displayUsers"
                :key="user.uid"
                class="w-full flex items-center gap-3 p-3 hover:bg-gray-100 active:bg-gray-200 rounded-md transition-colors min-h-[56px]"
                :disabled="isStartingChat"
                @click="startConversation(user)"
              >
                <Avatar :src="user.photoURL" :name="user.displayName" />
                <div class="text-left">
                  <div class="font-medium">{{ user.displayName }}</div>
                </div>
              </button>
            </div>
          </div>

          <div
            v-else-if="searchQuery.trim()"
            class="text-center py-8 text-gray-500"
          >
            ユーザーが見つかりませんでした
          </div>

          <div
            v-else
            class="text-center py-8 text-gray-500"
          >
            他のユーザーがまだいません
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
