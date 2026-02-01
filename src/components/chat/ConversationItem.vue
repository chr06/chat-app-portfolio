<script setup lang="ts">
import { computed } from 'vue'
import Avatar from '@/components/common/Avatar.vue'
import type { Conversation, ParticipantDetail } from '@/types'

interface Props {
  conversation: Conversation
  currentUserId: string
  isSelected?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isSelected: false,
})

const otherParticipant = computed((): ParticipantDetail | null => {
  const otherUserId = props.conversation.participants.find(
    (id) => id !== props.currentUserId
  )
  if (!otherUserId) return null
  return props.conversation.participantDetails[otherUserId] || null
})

const lastMessagePreview = computed(() => {
  const lastMessage = props.conversation.lastMessage
  if (!lastMessage) return 'メッセージがありません'

  const prefix =
    lastMessage.senderId === props.currentUserId ? 'あなた: ' : ''
  const text = lastMessage.text || '画像を送信しました'

  return prefix + (text.length > 30 ? text.slice(0, 30) + '...' : text)
})

const formattedTime = computed(() => {
  const timestamp = props.conversation.updatedAt
  if (!timestamp) return ''

  const date = timestamp.toDate()
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) {
    return date.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } else if (days === 1) {
    return '昨日'
  } else if (days < 7) {
    return ['日', '月', '火', '水', '木', '金', '土'][date.getDay()]
  } else {
    return date.toLocaleDateString('ja-JP', {
      month: 'short',
      day: 'numeric',
    })
  }
})
</script>

<template>
  <div
    :class="[
      'flex items-center gap-3 px-3 py-3 sm:py-2 rounded-md cursor-pointer transition-colors active:bg-white/20 min-h-[56px]',
      isSelected ? 'bg-slack-purple/20' : 'hover:bg-white/10',
    ]"
  >
    <Avatar
      :src="otherParticipant?.photoURL"
      :name="otherParticipant?.displayName"
      size="md"
    />

    <div class="flex-1 min-w-0">
      <div class="flex items-center justify-between">
        <span class="font-medium truncate">
          {{ otherParticipant?.displayName || '不明なユーザー' }}
        </span>
        <span class="text-xs text-gray-400 ml-2 flex-shrink-0">
          {{ formattedTime }}
        </span>
      </div>
      <p class="text-sm text-gray-400 truncate">
        {{ lastMessagePreview }}
      </p>
    </div>
  </div>
</template>
