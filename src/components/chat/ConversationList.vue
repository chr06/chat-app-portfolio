<script setup lang="ts">
import { onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useConversations } from '@/composables/useConversations'
import ConversationItem from './ConversationItem.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'

interface Emits {
  (e: 'select'): void
}

const emit = defineEmits<Emits>()

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const { userProfile } = storeToRefs(authStore)

const {
  conversations,
  isLoading,
  subscribeToConversations,
  unsubscribeFromConversations,
} = useConversations()

// ユーザーがログインしたら会話リストを監視開始
watch(
  () => userProfile.value?.uid,
  (uid) => {
    if (uid) {
      subscribeToConversations(uid)
    }
  },
  { immediate: true }
)

onUnmounted(() => {
  unsubscribeFromConversations()
})

function handleConversationClick(conversationId: string) {
  router.push({ name: 'conversation', params: { conversationId } })
  emit('select')
}

function isSelected(conversationId: string): boolean {
  return route.params.conversationId === conversationId
}
</script>

<template>
  <div>
    <!-- ローディング -->
    <div v-if="isLoading" class="flex justify-center py-4">
      <LoadingSpinner size="sm" color="text-gray-400" />
    </div>

    <!-- 会話リスト -->
    <div v-else-if="conversations.length > 0" class="space-y-1">
      <div
        v-for="conversation in conversations"
        :key="conversation.id"
        @click="handleConversationClick(conversation.id)"
      >
        <ConversationItem
          :conversation="conversation"
          :current-user-id="userProfile?.uid || ''"
          :is-selected="isSelected(conversation.id)"
        />
      </div>
    </div>

    <!-- 空状態 -->
    <div v-else class="text-center py-4 text-gray-400 text-sm">
      会話がありません
    </div>
  </div>
</template>
