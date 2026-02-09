<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { mdiEmoticonHappyOutline } from '@mdi/js'
import DOMPurify from 'dompurify'
import EmojiPicker from 'vue3-emoji-picker'
import 'vue3-emoji-picker/css'
import Avatar from '@/components/common/Avatar.vue'
import MdiIcon from '@/components/common/MdiIcon.vue'
import type { Message } from '@/types'

interface Props {
  message: Message
  isOwn: boolean
  currentUserId: string
  senderName?: string
  senderPhotoURL?: string
}

interface Emits {
  (e: 'add-reaction', messageId: string, emoji: string): void
  (e: 'remove-reaction', messageId: string, emoji: string): void
}

const props = withDefaults(defineProps<Props>(), {
  senderName: '',
  senderPhotoURL: '',
})

const emit = defineEmits<Emits>()

const showEmojiPicker = ref(false)
const showImageModal = ref(false)
const emojiPickerRef = ref<HTMLElement | null>(null)

// ピッカー外クリックで閉じる
function handleClickOutside(event: MouseEvent) {
  if (
    showEmojiPicker.value &&
    emojiPickerRef.value &&
    !emojiPickerRef.value.contains(event.target as Node)
  ) {
    showEmojiPicker.value = false
  }
}

// 他のピッカーが開いたら閉じる
function handleOtherPickerOpen(event: CustomEvent<string>) {
  if (event.detail !== props.message.id && showEmojiPicker.value) {
    showEmojiPicker.value = false
  }
}

// ピッカーを開く
function openEmojiPicker() {
  if (!showEmojiPicker.value) {
    // 他のピッカーを閉じるイベントを発火
    window.dispatchEvent(new CustomEvent('emoji-picker-open', { detail: props.message.id }))
    showEmojiPicker.value = true
  } else {
    showEmojiPicker.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  window.addEventListener('emoji-picker-open', handleOtherPickerOpen as EventListener)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('emoji-picker-open', handleOtherPickerOpen as EventListener)
})

const formattedTime = computed(() => {
  const timestamp = props.message.createdAt
  if (!timestamp) return ''

  const date = timestamp.toDate()
  return date.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  })
})

const sanitizedHtml = computed(() => {
  if (!props.message.text) return ''
  // 改行文字を <br> に変換してから sanitize
  const textWithBreaks = props.message.text.replace(/\n/g, '<br>')
  return DOMPurify.sanitize(textWithBreaks, {
    ALLOWED_TAGS: [
      'p',
      'br',
      'strong',
      'em',
      'u',
      's',
      'a',
      'ul',
      'ol',
      'li',
      'blockquote',
      'code',
      'pre',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
  })
})

const reactionEntries = computed(() => {
  return Object.entries(props.message.reactions || {}).filter(([, uids]) => uids.length > 0)
})

function hasReacted(emoji: string): boolean {
  const uids = props.message.reactions?.[emoji] || []
  return uids.includes(props.currentUserId)
}

function toggleReaction(emoji: string) {
  if (hasReacted(emoji)) {
    emit('remove-reaction', props.message.id, emoji)
  } else {
    emit('add-reaction', props.message.id, emoji)
  }
}

function handleSelectEmoji(emoji: { i: string }) {
  if (hasReacted(emoji.i)) {
    emit('remove-reaction', props.message.id, emoji.i)
  } else {
    emit('add-reaction', props.message.id, emoji.i)
  }
  showEmojiPicker.value = false
}
</script>

<template>
  <div :class="['flex gap-3', isOwn ? 'flex-row-reverse' : 'flex-row']">
    <!-- アバター（自分のメッセージでは非表示） -->
    <Avatar
      v-if="!isOwn"
      :src="senderPhotoURL"
      :name="senderName"
      size="sm"
      class="flex-shrink-0 mr-1"
    />

    <!-- メッセージコンテンツ（縦並び） -->
    <div :class="['max-w-[85%] sm:max-w-[70%] flex flex-col', isOwn ? 'items-end' : 'items-start']">
      <!-- メッセージバブル + 時刻（横並び） -->
      <div :class="['group flex items-end gap-2', isOwn ? 'flex-row-reverse' : 'flex-row']">
        <!-- メッセージバブル -->
        <div
          :class="[
            'rounded-lg px-4 py-2 relative',
            isOwn ? 'bg-[#601B61] text-white bubble-own' : 'bg-gray-200 text-gray-900 bubble-other',
          ]"
        >
          <!-- テキスト（リッチテキスト対応） -->
          <div v-if="message.text" class="message-content break-words" v-html="sanitizedHtml" />

          <!-- 画像 -->
          <div v-if="message.imageUrl" :class="message.text ? 'mt-2' : ''">
            <img
              :src="message.imageUrl"
              alt="送信画像"
              class="w-80 rounded-md cursor-pointer hover:opacity-90"
              @click="showImageModal = true"
            />
          </div>

          <!-- リアクションボタン（ホバーで表示、ピッカー表示中は常に表示） -->
          <div
            ref="emojiPickerRef"
            :class="[
              'absolute -bottom-2 right-0 transition-opacity',
              showEmojiPicker ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
            ]"
          >
            <button
              class="p-2 sm:p-1 bg-white rounded-full shadow-md hover:bg-gray-100 active:bg-gray-200 w-8 h-8 flex justify-center items-center"
              @click.stop="openEmojiPicker"
            >
              <MdiIcon :path="mdiEmoticonHappyOutline" :size="16" class="text-gray-600 w-5 h-5" />
            </button>

            <!-- 絵文字ピッカー -->
            <div v-if="showEmojiPicker" class="absolute top-full right-0 mt-2 z-10" @click.stop>
              <EmojiPicker
                :native="true"
                :disable-skin-tones="true"
                :disable-sticky-group-names="true"
                theme="light"
                @select="handleSelectEmoji"
              />
            </div>
          </div>
        </div>

        <!-- 時刻（バブル外側） -->
        <span class="text-xs text-gray-400 flex-shrink-0">
          {{ formattedTime }}
        </span>
      </div>

      <!-- リアクション表示（メッセージの下） -->
      <div
        v-if="reactionEntries.length > 0"
        :class="['flex flex-wrap gap-1 mt-1', isOwn ? 'justify-end' : 'justify-start']"
      >
        <button
          v-for="[emoji, uids] in reactionEntries"
          :key="emoji"
          :class="[
            'inline-flex items-center gap-1 px-3 py-1 sm:px-2 sm:py-0.5 rounded-full text-sm active:scale-95 transition-transform border-[1px]',
            isOwn
              ? 'bg-purple-100 text-purple-700 border-purple-400'
              : 'bg-gray-100 text-gray-700 border-gray-400',
          ]"
          @click="toggleReaction(emoji)"
        >
          <span>{{ emoji }}</span>
          <span class="text-xs">{{ uids.length }}</span>
        </button>
      </div>
    </div>
  </div>

  <!-- 画像拡大モーダル -->
  <Teleport to="body">
    <div
      v-if="showImageModal && message.imageUrl"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      @click="showImageModal = false"
    >
      <img :src="message.imageUrl" alt="送信画像" class="max-w-full max-h-full object-contain" />
    </div>
  </Teleport>
</template>

<style scoped>
/* 吹き出しのしっぽ - 相手のメッセージ（左側・上向き） */
.bubble-other::before {
  content: '';
  position: absolute;
  left: -12px;
  top: 8px;
  width: 0;
  height: 0;
  border-top: 0px solid transparent;
  border-bottom: 8px solid transparent;
  border-right: 12px solid rgb(229 231 235); /* bg-gray-200 */
}

/* 吹き出しのしっぽ - 自分のメッセージ（右側・上向き） */
.bubble-own::after {
  content: '';
  position: absolute;
  right: -12px;
  top: 8px;
  width: 0;
  height: 0;
  border-top: 0px solid transparent;
  border-bottom: 8px solid transparent;
  border-left: 12px solid #601b61;
}

/* リッチテキストコンテンツのスタイル */
.message-content :deep(p) {
  margin: 0;
}

.message-content :deep(p + p) {
  margin-top: 0.25rem;
}

.message-content :deep(strong) {
  font-weight: 700;
}

.message-content :deep(em) {
  font-style: italic;
}

.message-content :deep(u) {
  text-decoration: underline;
}

.message-content :deep(s) {
  text-decoration: line-through;
}

.message-content :deep(a) {
  text-decoration: underline;
}

.bubble-other .message-content :deep(a) {
  color: #2563eb;
}

.bubble-own .message-content :deep(a) {
  color: #bfdbfe;
}

.message-content :deep(ul) {
  list-style-type: disc;
  padding-left: 1.25rem;
  margin: 0.25rem 0;
}

.message-content :deep(ol) {
  list-style-type: decimal;
  padding-left: 1.25rem;
  margin: 0.25rem 0;
}

.message-content :deep(li) {
  margin: 0.125rem 0;
}

.message-content :deep(blockquote) {
  border-left: 3px solid currentColor;
  padding-left: 0.75rem;
  margin: 0.25rem 0;
  opacity: 0.8;
}

.message-content :deep(code) {
  font-family: ui-monospace, monospace;
  font-size: 0.8125em;
  color: #b91c1c;
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
}

.bubble-other .message-content :deep(code) {
  background-color: rgba(0, 0, 0, 0.1);
}

.bubble-own .message-content :deep(code) {
  color: #b91c1c;
  background-color: rgba(255, 255, 255, 0.5);
}

.message-content :deep(pre) {
  margin: 0.25rem 0;
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  overflow-x: auto;
  font-family: ui-monospace, monospace;
  font-size: 0.875em;
}

.bubble-other .message-content :deep(pre) {
  background-color: #1f2937;
  color: #f9fafb;
}

.bubble-own .message-content :deep(pre) {
  background-color: rgba(0, 0, 0, 0.3);
  color: #f9fafb;
}

.message-content :deep(pre code) {
  background: none;
  padding: 0;
  color: #ffffff;
}

.bubble-own .message-content :deep(pre code) {
  background: none;
  color: #ffffff;
}

.bubble-other .message-content :deep(pre code) {
  background: none;
  color: #ffffff;
}
</style>
