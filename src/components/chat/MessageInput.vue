<script setup lang="ts">
import { ref, computed, onBeforeUnmount, watch } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import {
  mdiImage,
  mdiSend,
  mdiFormatBold,
  mdiFormatItalic,
  mdiFormatUnderline,
  mdiFormatStrikethrough,
  mdiLink,
  mdiFormatListNumbered,
  mdiFormatListBulleted,
  mdiFormatQuoteClose,
  mdiCodeTags,
  mdiCodeBracesBox,
  mdiEmoticonHappyOutline,
} from '@mdi/js'
import EmojiPicker from 'vue3-emoji-picker'
import 'vue3-emoji-picker/css'
import ImagePreview from './ImagePreview.vue'
import MdiIcon from '@/components/common/MdiIcon.vue'

interface Props {
  recipientName?: string
}

interface Emits {
  (e: 'send', text: string): void
  (e: 'send-image', file: File, text: string): void
}

const props = withDefaults(defineProps<Props>(), {
  recipientName: '',
})

const emit = defineEmits<Emits>()

const placeholderText = computed(() => {
  return props.recipientName ? `${props.recipientName} へのメッセージ` : 'メッセージを入力...'
})

const isMac = navigator.userAgent.includes('Mac')
const sendShortcutLabel = isMac ? '⌘+Enter で送信' : 'Ctrl+Enter で送信'

const imageFile = ref<File | null>(null)
const imagePreviewUrl = ref<string | null>(null)
const isSending = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const errorMessage = ref('')
const showEmojiPicker = ref(false)
const emojiPickerRef = ref<HTMLElement | null>(null)
const showLinkDialog = ref(false)
const linkUrl = ref('')
const linkText = ref('')

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

// TipTap Editor
const editor = useEditor({
  extensions: [
    StarterKit.configure({
      heading: false,
      horizontalRule: false,
    }),
    Underline,
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        class: 'text-blue-600 underline',
      },
    }),
    Placeholder.configure({
      placeholder: placeholderText.value,
    }),
  ],
  editorProps: {
    attributes: {
      class:
        'prose prose-sm max-w-none focus:outline-none min-h-[42px] max-h-32 overflow-y-auto px-4 py-2',
    },
    handleKeyDown: (view, event) => {
      // IME変換中は無視
      if (event.isComposing) return false

      // Command+Enter (Mac) / Ctrl+Enter (Win) で送信
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        handleSend()
        return true
      }
      return false
    },
  },
})

// プレースホルダーの更新
watch(placeholderText, (newPlaceholder) => {
  if (editor.value) {
    editor.value.extensionManager.extensions
      .filter((ext) => ext.name === 'placeholder')
      .forEach((ext) => {
        ;(ext.options as { placeholder: string }).placeholder = newPlaceholder
      })
  }
})

onBeforeUnmount(() => {
  editor.value?.destroy()
})

const isEmpty = computed(() => {
  return !editor.value?.getText().trim()
})

async function handleSend() {
  if (isSending.value || !editor.value) return

  errorMessage.value = ''
  const html = editor.value.getHTML()
  const text = editor.value.getText().trim()

  // 画像がある場合
  if (imageFile.value) {
    isSending.value = true
    try {
      emit('send-image', imageFile.value, html)
      clearImage()
      editor.value.commands.clearContent()
    } finally {
      isSending.value = false
    }
    return
  }

  // テキストのみの場合
  if (!text) return

  isSending.value = true
  try {
    emit('send', html)
    editor.value.commands.clearContent()
  } finally {
    isSending.value = false
  }
}

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) return

  if (file.size > MAX_FILE_SIZE) {
    errorMessage.value = '画像は5MB以下にしてください'
    return
  }

  if (!file.type.startsWith('image/')) {
    errorMessage.value = '画像ファイルを選択してください'
    return
  }

  errorMessage.value = ''
  imageFile.value = file
  imagePreviewUrl.value = URL.createObjectURL(file)
  target.value = ''
}

function clearImage() {
  if (imagePreviewUrl.value) {
    URL.revokeObjectURL(imagePreviewUrl.value)
  }
  imageFile.value = null
  imagePreviewUrl.value = null
}

function openFilePicker() {
  fileInputRef.value?.click()
}

// 絵文字ピッカー
function toggleEmojiPicker() {
  showEmojiPicker.value = !showEmojiPicker.value
}

function handleSelectEmoji(emoji: { i: string }) {
  editor.value?.commands.insertContent(emoji.i)
  showEmojiPicker.value = false
}

function handleClickOutsideEmoji(event: MouseEvent) {
  if (
    showEmojiPicker.value &&
    emojiPickerRef.value &&
    !emojiPickerRef.value.contains(event.target as Node)
  ) {
    showEmojiPicker.value = false
  }
}

// リンク挿入ダイアログ
function openLinkDialog() {
  // 選択中のテキストがあればテキスト欄に入れる
  const { from, to } = editor.value?.state.selection || { from: 0, to: 0 }
  const selectedText = editor.value?.state.doc.textBetween(from, to, '') || ''
  linkText.value = selectedText
  // 既存リンクのURLがあれば入れる
  const previousUrl = editor.value?.getAttributes('link').href
  linkUrl.value = previousUrl || ''
  showLinkDialog.value = true
}

function closeLinkDialog() {
  showLinkDialog.value = false
  linkUrl.value = ''
  linkText.value = ''
}

function insertLink() {
  if (!linkUrl.value || !linkText.value) return

  const { from, to } = editor.value?.state.selection || { from: 0, to: 0 }
  const hasSelection = from !== to

  if (hasSelection) {
    // 選択範囲にリンクを適用し、テキストを置換
    editor.value
      ?.chain()
      .focus()
      .deleteRange({ from, to })
      .insertContent(`<a href="${linkUrl.value}">${linkText.value}</a>`)
      .run()
  } else {
    // カーソル位置にリンクテキストを挿入
    editor.value
      ?.chain()
      .focus()
      .insertContent(`<a href="${linkUrl.value}">${linkText.value}</a>`)
      .run()
  }

  closeLinkDialog()
}

// 引用トグル（選択テキストのみ適用）
function toggleBlockquote() {
  if (!editor.value) return

  // 既に引用内にいる場合は解除
  if (editor.value.isActive('blockquote')) {
    editor.value.chain().focus().toggleBlockquote().run()
    return
  }

  const { from, to } = editor.value.state.selection
  const hasSelection = from !== to

  if (hasSelection) {
    // 選択テキストを取得して引用ブロックとして挿入
    const selectedText = editor.value.state.doc.textBetween(from, to, '\n')
    editor.value
      .chain()
      .focus()
      .deleteRange({ from, to })
      .insertContent(`<blockquote><p>${selectedText}</p></blockquote>`)
      .run()
  } else {
    // 選択なしの場合は現在の段落を引用に
    editor.value.chain().focus().toggleBlockquote().run()
  }
}

// ツールバーボタン
type ToolbarButton =
  | { type: 'divider' }
  | {
      type?: never
      icon: string
      label: string
      action: () => void
      isActive: () => boolean | undefined
    }

const toolbarButtons = computed<ToolbarButton[]>(() => [
  {
    icon: mdiFormatBold,
    label: '太字',
    action: () => editor.value?.chain().focus().toggleBold().run(),
    isActive: () => editor.value?.isActive('bold'),
  },
  {
    icon: mdiFormatItalic,
    label: 'イタリック',
    action: () => editor.value?.chain().focus().toggleItalic().run(),
    isActive: () => editor.value?.isActive('italic'),
  },
  {
    icon: mdiFormatUnderline,
    label: '下線',
    action: () => editor.value?.chain().focus().toggleUnderline().run(),
    isActive: () => editor.value?.isActive('underline'),
  },
  {
    icon: mdiFormatStrikethrough,
    label: '取り消し線',
    action: () => editor.value?.chain().focus().toggleStrike().run(),
    isActive: () => editor.value?.isActive('strike'),
  },
  { type: 'divider' },
  {
    icon: mdiLink,
    label: 'リンク',
    action: openLinkDialog,
    isActive: () => editor.value?.isActive('link'),
  },
  { type: 'divider' },
  {
    icon: mdiFormatListNumbered,
    label: '番号付きリスト',
    action: () => editor.value?.chain().focus().toggleOrderedList().run(),
    isActive: () => editor.value?.isActive('orderedList'),
  },
  {
    icon: mdiFormatListBulleted,
    label: '箇条書き',
    action: () => editor.value?.chain().focus().toggleBulletList().run(),
    isActive: () => editor.value?.isActive('bulletList'),
  },
  {
    icon: mdiFormatQuoteClose,
    label: '引用',
    action: toggleBlockquote,
    isActive: () => editor.value?.isActive('blockquote'),
  },
  { type: 'divider' },
  {
    icon: mdiCodeTags,
    label: 'コード',
    action: () => editor.value?.chain().focus().toggleCode().run(),
    isActive: () => editor.value?.isActive('code'),
  },
  {
    icon: mdiCodeBracesBox,
    label: 'コードブロック',
    action: () => editor.value?.chain().focus().toggleCodeBlock().run(),
    isActive: () => editor.value?.isActive('codeBlock'),
  },
])
</script>

<template>
  <div class="bg-white border-t" @click="handleClickOutsideEmoji">
    <!-- エラーメッセージ -->
    <div v-if="errorMessage" class="mx-4 mt-4 p-2 bg-red-100 text-red-700 text-sm rounded-md">
      {{ errorMessage }}
    </div>

    <!-- 画像プレビュー -->
    <ImagePreview
      v-if="imagePreviewUrl"
      :src="imagePreviewUrl"
      :file-name="imageFile?.name"
      class="mx-4 mt-4"
      @remove="clearImage"
    />

    <!-- エディターエリア -->
    <div class="p-4 pb-3">
      <!-- 隠しファイル入力 -->
      <input
        ref="fileInputRef"
        type="file"
        accept="image/*"
        class="hidden"
        @change="handleFileSelect"
      />

      <!-- ツールバー + エディター + ボタン -->
      <div
        class="border border-gray-200 rounded-lg focus-within:ring-2 focus-within:ring-gray-600 focus-within:border-transparent"
      >
        <!-- ツールバー -->
        <div class="flex items-center gap-1 px-2 py-1 bg-gray-50 rounded-t-lg flex-wrap">
          <template v-for="(btn, index) in toolbarButtons" :key="index">
            <div v-if="btn.type === 'divider'" class="w-px h-5 bg-gray-300 mx-1" />
            <button
              v-else-if="'icon' in btn"
              type="button"
              :class="[
                'toolbar-btn p-1.5 rounded hover:bg-gray-200 transition-colors',
                btn.isActive?.() ? 'bg-gray-200 text-purple-700' : 'text-gray-600',
              ]"
              :aria-label="btn.label"
              :data-tooltip="btn.label"
              @click="btn.action"
            >
              <MdiIcon :path="btn.icon" :size="18" />
            </button>
          </template>
        </div>

        <!-- エディター -->
        <EditorContent :editor="editor" />

        <!-- 画像添付ボタン + 絵文字ボタン + 送信ボタン -->
        <div class="flex items-center justify-between px-2 py-1.5 bg-white rounded-b-lg">
          <!-- 左側: 画像添付ボタン + 絵文字ボタン -->
          <div class="flex items-center gap-1">
            <!-- 画像添付ボタン -->
            <button
              type="button"
              class="toolbar-btn p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 active:bg-gray-300 rounded-md"
              :disabled="isSending"
              aria-label="画像を添付"
              data-tooltip="画像を添付"
              @click="openFilePicker"
            >
              <MdiIcon :path="mdiImage" :size="20" />
            </button>

            <!-- 絵文字ボタン -->
            <div class="relative" ref="emojiPickerRef">
              <button
                type="button"
                :class="[
                  'toolbar-btn p-1.5 rounded-md hover:bg-gray-200 active:bg-gray-300 transition-colors',
                  showEmojiPicker
                    ? 'bg-gray-200 text-purple-700'
                    : 'text-gray-500 hover:text-gray-700',
                ]"
                aria-label="絵文字"
                data-tooltip="絵文字"
                @click.stop="toggleEmojiPicker"
              >
                <MdiIcon :path="mdiEmoticonHappyOutline" :size="20" />
              </button>

              <!-- 絵文字ピッカー -->
              <div v-if="showEmojiPicker" class="absolute bottom-full left-0 mb-2 z-20" @click.stop>
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

          <!-- 送信ボタン（右下） -->
          <button
            type="button"
            class="toolbar-btn p-1.5 bg-[#601B61] text-white rounded-md hover:bg-opacity-90 active:bg-opacity-80 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            :disabled="isSending || (isEmpty && !imageFile)"
            aria-label="送信"
            data-tooltip="送信する"
            @click="handleSend"
          >
            <MdiIcon :path="mdiSend" :size="20" />
          </button>
        </div>
      </div>

      <!-- ヒント -->
      <p class="mt-1 text-xs text-gray-400 ml-1">{{ `Enter で改行、${sendShortcutLabel}` }}</p>
    </div>
  </div>

  <!-- リンク追加ダイアログ -->
  <Teleport to="body">
    <div
      v-if="showLinkDialog"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      @click.self="closeLinkDialog"
    >
      <div class="bg-white rounded-lg shadow-xl w-full max-w-md p-6" @click.stop>
        <h3 class="text-lg font-semibold mb-4">リンク追加</h3>

        <!-- テキスト入力 -->
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">
            テキスト <span class="text-red-500">*</span>
          </label>
          <input
            v-model="linkText"
            type="text"
            placeholder="表示するテキストを入力..."
            class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus-within:ring-gray-600 focus:border-transparent"
          />
        </div>

        <!-- リンク入力 -->
        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-700 mb-1">
            リンク <span class="text-red-500">*</span>
          </label>
          <input
            v-model="linkUrl"
            type="url"
            placeholder="https://..."
            class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus-within:ring-gray-600 focus:border-transparent"
            @keydown.enter="insertLink"
          />
        </div>

        <!-- ボタン -->
        <div class="flex justify-end gap-3">
          <button
            type="button"
            class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            @click="closeLinkDialog"
          >
            キャンセル
          </button>
          <button
            type="button"
            class="px-4 py-2 text-sm bg-[#601B61] text-white rounded-lg hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!linkText.trim() || !linkUrl.trim()"
            @click="insertLink"
          >
            保存する
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* ツールバーボタンのツールチップ */
.toolbar-btn {
  position: relative;
}

.toolbar-btn::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 8px;
  background-color: #1f2937;
  color: #fff;
  font-size: 12px;
  line-height: 1.4;
  white-space: nowrap;
  border-radius: 4px;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s;
}

.toolbar-btn:hover::after {
  opacity: 1;
}

:deep(.ProseMirror) {
  min-height: 42px;
  max-height: 128px;
  overflow-y: auto;
}

:deep(.ProseMirror p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  color: #9ca3af;
  pointer-events: none;
  height: 0;
}

:deep(.ProseMirror p) {
  margin: 0;
}

:deep(.ProseMirror ul) {
  list-style-type: disc;
  padding-left: 1.5rem;
  margin: 0.25rem 0;
}

:deep(.ProseMirror ol) {
  list-style-type: decimal;
  padding-left: 1.5rem;
  margin: 0.25rem 0;
}

:deep(.ProseMirror blockquote) {
  border-left: 3px solid #d1d5db;
  padding-left: 1rem;
  margin: 0.25rem 0;
  color: #6b7280;
}

:deep(.ProseMirror code) {
  background-color: #f3f4f6;
  color: #dc2626;
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  font-family: monospace;
  font-size: 0.8125rem;
}

:deep(.ProseMirror pre) {
  background-color: #1f2937;
  color: #f9fafb;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  margin: 0.25rem 0;
  overflow-x: auto;
}

:deep(.ProseMirror pre code) {
  background: none;
  padding: 0;
  color: inherit;
}
</style>
