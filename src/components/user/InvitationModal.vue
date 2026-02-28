<script setup lang="ts">
import { ref } from 'vue'
import { mdiClose, mdiLinkVariant, mdiCheck } from '@mdi/js'
import { useInvitations } from '@/composables/useInvitations'
import MdiIcon from '@/components/common/MdiIcon.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'

interface Emits {
  (e: 'close'): void
}

const emit = defineEmits<Emits>()

const { createInvitation, generateInvitationUrl, isCreating } = useInvitations()

const isCopied = ref(false)
const errorMessage = ref('')

async function handleCopyLink() {
  errorMessage.value = ''

  try {
    const code = await createInvitation()
    if (!code) {
      errorMessage.value = '招待リンクの作成に失敗しました'
      return
    }

    const url = generateInvitationUrl(code)
    await navigator.clipboard.writeText(url)
    isCopied.value = true
    setTimeout(() => (isCopied.value = false), 2000)
  } catch {
    errorMessage.value = '招待リンクのコピーに失敗しました'
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    emit('close')
  }
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4" @keydown="handleKeydown">
    <div class="absolute inset-0 bg-black/50" @click="emit('close')" />

    <div class="relative bg-white rounded-lg shadow-xl w-full max-w-md flex flex-col">
      <div class="flex items-center justify-between p-4 border-b">
        <h2 class="text-lg font-semibold">メンバーを招待</h2>
        <button
          class="p-2 hover:bg-gray-100 active:bg-gray-200 rounded-md min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="閉じる"
          @click="emit('close')"
        >
          <MdiIcon :path="mdiClose" :size="20" />
        </button>
      </div>

      <div class="p-6">
        <div v-if="errorMessage" class="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
          {{ errorMessage }}
        </div>

        <p class="text-sm text-gray-600 mb-4 whitespace-pre-line">
          {{
            `招待リンクを作成して相手に共有してください。\n相手がリンクからログインすると、お互いにチャットできるようになります。`
          }}
        </p>

        <button
          :disabled="isCreating"
          class="w-full py-3 bg-slack-purple text-white rounded-md hover:bg-opacity-90 disabled:opacity-50 transition-colors font-medium flex items-center justify-center gap-2"
          @click="handleCopyLink"
        >
          <LoadingSpinner v-if="isCreating" size="sm" color="text-white" />
          <template v-else>
            <MdiIcon :path="isCopied ? mdiCheck : mdiLinkVariant" :size="20" />
            {{ isCopied ? 'コピーしました' : '招待リンクをコピー' }}
          </template>
        </button>
      </div>
    </div>
  </div>
</template>
