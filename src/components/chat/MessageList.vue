<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from 'vue'
import { mdiChatProcessingOutline } from '@mdi/js'
import MessageItem from './MessageItem.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import MdiIcon from '@/components/common/MdiIcon.vue'
import type { Message, ParticipantDetail } from '@/types'

interface Props {
  messages: Message[]
  currentUserId: string
  participantDetails?: Record<string, ParticipantDetail>
  isLoading?: boolean
  isLoadingMore?: boolean
  hasMore?: boolean
}

interface Emits {
  (e: 'load-more'): void
  (e: 'add-reaction', messageId: string, emoji: string): void
  (e: 'remove-reaction', messageId: string, emoji: string): void
}

const props = withDefaults(defineProps<Props>(), {
  participantDetails: () => ({}),
  isLoading: false,
  isLoadingMore: false,
  hasMore: true,
})

// 送信者の情報を取得
function getSenderInfo(senderId: string) {
  const detail = props.participantDetails[senderId]
  return {
    name: detail?.displayName || '',
    photoURL: detail?.photoURL || '',
  }
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

// メッセージの日付を取得
function getMessageDate(message: Message | undefined): Date | null {
  if (!message?.createdAt) return null
  return message.createdAt.toDate()
}

// 日付が前のメッセージと異なるか判定
function isNewDate(index: number): boolean {
  const current = getMessageDate(props.messages[index])
  if (!current) return false

  if (index === 0) return true

  const prev = getMessageDate(props.messages[index - 1])
  if (!prev) return true

  return (
    current.getFullYear() !== prev.getFullYear() ||
    current.getMonth() !== prev.getMonth() ||
    current.getDate() !== prev.getDate()
  )
}

// 日付ラベルをフォーマット
function formatDateLabel(index: number): string {
  const date = getMessageDate(props.messages[index])
  if (!date) return ''

  const now = new Date()
  const day = WEEKDAYS[date.getDay()]

  if (date.getFullYear() !== now.getFullYear()) {
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日(${day})`
  }
  return `${date.getMonth() + 1}/${date.getDate()}(${day})`
}

const emit = defineEmits<Emits>()

const containerRef = ref<HTMLDivElement | null>(null)
const shouldAutoScroll = ref(true)

// メッセージが追加されたら自動スクロール
watch(
  () => props.messages.length,
  async (newLength, oldLength) => {
    if (newLength > oldLength && shouldAutoScroll.value) {
      await nextTick()
      scrollToBottom()
    }
  },
)

// 初回表示時にスクロール
onMounted(async () => {
  await nextTick()
  scrollToBottom()
})

function scrollToBottom() {
  if (containerRef.value) {
    containerRef.value.scrollTop = containerRef.value.scrollHeight
  }
}

function handleScroll(event: Event) {
  const target = event.target as HTMLDivElement
  const { scrollTop, scrollHeight, clientHeight } = target

  // 下端近くにいるかチェック（自動スクロールの判定用）
  shouldAutoScroll.value = scrollHeight - scrollTop - clientHeight < 100

  // 上端到達で追加読み込み
  if (scrollTop < 50 && props.hasMore && !props.isLoadingMore) {
    const previousScrollHeight = scrollHeight

    emit('load-more')

    // スクロール位置を維持
    nextTick(() => {
      if (containerRef.value) {
        const newScrollHeight = containerRef.value.scrollHeight
        containerRef.value.scrollTop = newScrollHeight - previousScrollHeight
      }
    })
  }
}

function handleAddReaction(messageId: string, emoji: string) {
  emit('add-reaction', messageId, emoji)
}

function handleRemoveReaction(messageId: string, emoji: string) {
  emit('remove-reaction', messageId, emoji)
}
</script>

<template>
  <div ref="containerRef" class="flex-1 overflow-y-auto p-4 space-y-4" @scroll="handleScroll">
    <!-- 追加読み込み中 -->
    <div v-if="isLoadingMore" class="flex justify-center py-2">
      <LoadingSpinner size="sm" />
    </div>

    <!-- これ以上メッセージがない -->
    <div v-else-if="!hasMore && messages.length > 0" class="text-center text-sm text-gray-400 py-2">
      これ以上メッセージはありません
    </div>

    <!-- ローディング -->
    <div v-if="isLoading" class="flex justify-center py-8">
      <LoadingSpinner />
    </div>

    <!-- メッセージ一覧 -->
    <template v-else>
      <template v-for="(message, index) in messages" :key="message.id">
        <!-- 日付セパレーター -->
        <div v-if="isNewDate(index)" class="flex justify-center my-2">
          <span class="text-xs text-gray-500 bg-gray-100 rounded-full px-3 py-1">{{ formatDateLabel(index) }}</span>
        </div>

        <MessageItem
          :message="message"
          :isOwn="message.senderId === currentUserId"
          :currentUserId="currentUserId"
          :senderName="getSenderInfo(message.senderId).name"
          :senderPhotoURL="getSenderInfo(message.senderId).photoURL"
          @add-reaction="handleAddReaction"
          @remove-reaction="handleRemoveReaction"
        />
      </template>

      <!-- 空状態 -->
      <div
        v-if="messages.length === 0"
        class="flex items-center justify-center h-full text-gray-500"
      >
        <div class="text-center">
          <MdiIcon :path="mdiChatProcessingOutline" :size="48" class="mx-auto text-gray-400 mb-4" />
          <p>メッセージを送信してみましょう</p>
        </div>
      </div>
    </template>
  </div>
</template>
