<script setup lang="ts">
import MdiIcon from '@/components/common/MdiIcon.vue'
import { mdiPlus, mdiAccountPlus } from '@mdi/js'

interface Props {
  isOpen?: boolean
}

interface Emits {
  (e: 'close'): void
  (e: 'new-conversation'): void
  (e: 'invite'): void
}

withDefaults(defineProps<Props>(), {
  isOpen: false,
})

const emit = defineEmits<Emits>()
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 bg-black/50 z-40 lg:hidden" @click="emit('close')" />

  <aside
    :class="[
      'fixed top-14 left-0 bottom-0 w-72 bg-gray-900 text-white z-40 transform transition-transform duration-200 ease-in-out',
      'lg:translate-x-0',
      isOpen ? 'translate-x-0' : '-translate-x-full',
    ]"
  >
    <div class="flex flex-col h-full">
      <div class="p-3 border-b border-gray-700">
        <button
          class="w-full px-4 py-2 bg-white/10 hover:bg-white/20 rounded-md text-sm font-medium transition-colors flex items-center justify-center"
          @click="emit('new-conversation')"
        >
          <MdiIcon :path="mdiPlus" :size="20" />
          <span class="ml-1">新しいメッセージ</span>
        </button>
      </div>

      <div class="flex-1 overflow-y-auto">
        <div class="p-2">
          <h2 class="px-2 py-1 text-xs font-semibold text-gray-400 uppercase">
            ダイレクトメッセージ
          </h2>
          <slot name="conversations" />
        </div>
      </div>

      <div class="p-3 border-t border-gray-700">
        <button
          class="w-full px-4 py-2 bg-white/5 hover:bg-white/10 rounded-md text-sm font-medium transition-colors flex items-center justify-center"
          @click="emit('invite')"
        >
          <MdiIcon :path="mdiAccountPlus" :size="20" />
          <span class="ml-1">メンバーを招待</span>
        </button>
      </div>
    </div>
  </aside>
</template>
