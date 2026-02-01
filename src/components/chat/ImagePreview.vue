<script setup lang="ts">
import { mdiClose } from '@mdi/js'
import MdiIcon from '@/components/common/MdiIcon.vue'

interface Props {
  src: string
  fileName?: string
}

interface Emits {
  (e: 'remove'): void
}

withDefaults(defineProps<Props>(), {
  fileName: '',
})

defineEmits<Emits>()
</script>

<template>
  <div class="relative inline-block">
    <!-- 画像コンテナ -->
    <div class="relative rounded-lg overflow-hidden bg-gray-100 border">
      <img :src="src" :alt="fileName || '添付画像'" class="max-w-xs max-h-48 object-contain" />

      <!-- 削除ボタン -->
      <button
        type="button"
        class="absolute top-1 right-1 p-1 bg-black/50 hover:bg-black/70 rounded-full text-white h-6 w-6 flex justify-center item-center"
        aria-label="画像を削除"
        @click="$emit('remove')"
      >
        <MdiIcon :path="mdiClose" :size="16" />
      </button>
    </div>

    <!-- ファイル名 -->
    <p v-if="fileName" class="mt-1 text-xs text-gray-500 truncate max-w-xs">
      {{ fileName }}
    </p>
  </div>
</template>
