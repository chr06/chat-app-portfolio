<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { mdiChatProcessingOutline, mdiChevronLeft, mdiDotsVertical, mdiCheckCircleOutline } from '@mdi/js'
import { useAuthStore } from '@/stores/auth'
import { useConversations } from '@/composables/useConversations'
import { useMessages } from '@/composables/useMessages'
import { useImageUpload } from '@/composables/useImageUpload'
import AppHeader from '@/components/layout/AppHeader.vue'
import Sidebar from '@/components/layout/Sidebar.vue'
import ConversationList from '@/components/chat/ConversationList.vue'
import MessageList from '@/components/chat/MessageList.vue'
import MessageInput from '@/components/chat/MessageInput.vue'
import UserSearch from '@/components/user/UserSearch.vue'
import UserProfile from '@/components/user/UserProfile.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import Avatar from '@/components/common/Avatar.vue'
import MdiIcon from '@/components/common/MdiIcon.vue'
import type { Conversation } from '@/types'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { userProfile } = storeToRefs(authStore)

// サイドバー状態
const isSidebarOpen = ref(false)
const showUserSearch = ref(false)
const showConversationMenu = ref(false)
const showUserProfile = ref(false)
const toastMessage = ref('')
let toastTimer: ReturnType<typeof setTimeout> | null = null

function showToast(message: string) {
  if (toastTimer) clearTimeout(toastTimer)
  toastMessage.value = message
  toastTimer = setTimeout(() => {
    toastMessage.value = ''
  }, 3000)
}

// 現在の会話ID
const currentConversationId = computed(() => {
  return route.params.conversationId as string | undefined
})

// 会話
const { conversations, getOtherParticipant, getConversationById, hideConversation } = useConversations()

// 直接取得した会話データ（フォールバック用）
const fetchedConversation = ref<Conversation | null>(null)

// 会話IDが変わったら直接取得を試みる
watch(
  currentConversationId,
  async (newId) => {
    if (newId) {
      const conv = await getConversationById(newId)
      fetchedConversation.value = conv
    } else {
      fetchedConversation.value = null
    }
  },
  { immediate: true },
)

// 現在の会話データ（リストから取得、なければ直接取得したもの）
const currentConversation = computed(() => {
  if (!currentConversationId.value) return null
  const fromList = conversations.value.find((c) => c.id === currentConversationId.value)
  return fromList || fetchedConversation.value
})

// 相手の情報
const otherParticipant = computed(() => {
  if (!currentConversation.value || !userProfile.value) return null
  return getOtherParticipant(currentConversation.value, userProfile.value.uid)
})

// メッセージ
const {
  messages,
  isLoading: isMessagesLoading,
  isLoadingMore,
  hasMore,
  loadMoreMessages,
  sendMessage: sendTextMessage,
  sendImageMessage,
  addReaction,
  removeReaction,
} = useMessages(currentConversationId)

// 画像アップロード
const { compressAndUpload, isUploading, uploadProgress } = useImageUpload()

// サイドバー操作
function toggleSidebar() {
  isSidebarOpen.value = !isSidebarOpen.value
}

function closeSidebar() {
  isSidebarOpen.value = false
}

// 新規会話
function handleNewConversation() {
  showUserSearch.value = true
  closeSidebar()
}

function handleCloseUserSearch() {
  showUserSearch.value = false
}

// メッセージ送信
async function handleSendMessage(text: string) {
  await sendTextMessage(text)
}

// 画像送信
async function handleSendImage(file: File, text: string) {
  try {
    const { url, path } = await compressAndUpload(file)
    await sendImageMessage(url, path, text)
  } catch (error) {
    console.error('Error sending image:', error)
  }
}

// リアクション
function handleAddReaction(messageId: string, emoji: string) {
  addReaction(messageId, emoji)
}

function handleRemoveReaction(messageId: string, emoji: string) {
  removeReaction(messageId, emoji)
}

// モバイルで戻る
function handleBack() {
  router.push({ name: 'chat' })
}

// 会話選択時にサイドバーを閉じる（モバイル）
function handleConversationSelect() {
  closeSidebar()
}

// 会話メニュー
function toggleConversationMenu() {
  showConversationMenu.value = !showConversationMenu.value
}

function closeConversationMenu() {
  showConversationMenu.value = false
}

// 会話を非表示にする
async function handleHideConversation() {
  closeConversationMenu()

  if (!currentConversationId.value) return

  try {
    await hideConversation(currentConversationId.value)
    // 会話リストに戻る
    router.push({ name: 'chat' })
  } catch (error) {
    console.error('Error hiding conversation:', error)
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-100">
    <!-- ヘッダー -->
    <AppHeader @toggle-sidebar="toggleSidebar" @open-profile="showUserProfile = true" />

    <!-- サイドバー -->
    <Sidebar
      :is-open="isSidebarOpen"
      @close="closeSidebar"
      @new-conversation="handleNewConversation"
    >
      <template #conversations>
        <ConversationList @select="handleConversationSelect" />
      </template>
    </Sidebar>

    <!-- メインコンテンツ -->
    <main class="pt-14 lg:pl-72 min-h-screen">
      <div class="h-[calc(100vh-3.5rem)] flex flex-col bg-white">
        <!-- 会話が選択されていない場合 -->
        <div
          v-if="!currentConversationId"
          class="flex-1 flex items-center justify-center text-gray-500"
        >
          <div class="text-center">
            <MdiIcon
              :path="mdiChatProcessingOutline"
              :size="48"
              class="mx-auto text-gray-400 mb-4"
            />
            <p class="text-lg font-medium">会話を選択してください</p>
            <p class="mt-1 text-sm">
              左のサイドバーから会話を選択するか、<br />
              新しいメッセージを開始してください。
            </p>
          </div>
        </div>

        <!-- 会話が選択されている場合 -->
        <template v-else>
          <!-- 会話ヘッダー -->
          <div class="flex items-center gap-3 px-4 py-3 border-b bg-white">
            <Avatar
              :src="otherParticipant?.photoURL"
              :name="otherParticipant?.displayName"
              size="sm"
            />
            <div class="flex-1">
              <h2 class="font-medium">
                {{ otherParticipant?.displayName || '不明なユーザー' }}
              </h2>
            </div>

            <!-- 三点メニュー -->
            <div class="relative">
              <button
                class="p-2 hover:bg-gray-100 rounded-md"
                aria-label="メニュー"
                @click="toggleConversationMenu"
              >
                <MdiIcon :path="mdiDotsVertical" :size="20" />
              </button>

              <!-- ドロップダウンメニュー -->
              <div
                v-if="showConversationMenu"
                class="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border py-1 min-w-[160px] z-10"
              >
                <button
                  class="w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                  @click="handleHideConversation"
                >
                  非表示にする
                </button>
              </div>

              <!-- メニュー外クリックで閉じる -->
              <div
                v-if="showConversationMenu"
                class="fixed inset-0 z-0"
                @click="closeConversationMenu"
              />
            </div>
          </div>

          <!-- メッセージリスト -->
          <MessageList
            :messages="messages"
            :current-user-id="userProfile?.uid || ''"
            :participant-details="currentConversation?.participantDetails || {}"
            :is-loading="isMessagesLoading"
            :is-loading-more="isLoadingMore"
            :has-more="hasMore"
            @load-more="loadMoreMessages"
            @add-reaction="handleAddReaction"
            @remove-reaction="handleRemoveReaction"
          />

          <!-- アップロード進捗 -->
          <div v-if="isUploading" class="px-4 py-2 bg-blue-50 border-t flex items-center gap-2">
            <LoadingSpinner size="sm" />
            <span class="text-sm text-blue-700">
              画像をアップロード中... {{ uploadProgress }}%
            </span>
          </div>

          <!-- メッセージ入力 -->
          <MessageInput
            :recipient-name="otherParticipant?.displayName"
            @send="handleSendMessage"
            @send-image="handleSendImage"
          />
        </template>
      </div>
    </main>

    <!-- ユーザー検索モーダル -->
    <UserSearch v-if="showUserSearch" @close="handleCloseUserSearch" />

    <!-- プロフィール編集モーダル -->
    <UserProfile
      v-if="showUserProfile"
      @close="showUserProfile = false"
      @saved="showToast"
    />

    <!-- トースト通知 -->
    <Teleport to="body">
      <Transition name="toast">
        <div
          v-if="toastMessage"
          class="fixed bottom-4 left-4 z-50 px-4 py-3 bg-green-600 text-white text-sm rounded-lg shadow-lg flex items-center gap-2"
        >
          <MdiIcon :path="mdiCheckCircleOutline" :size="18" />
          <span>{{ toastMessage }}</span>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.toast-enter-active {
  transition: all 0.3s ease;
}
.toast-leave-active {
  transition: all 0.3s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-100%);
}
</style>
