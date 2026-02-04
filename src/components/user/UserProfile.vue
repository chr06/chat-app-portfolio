<script setup lang="ts">
import { ref, computed } from 'vue'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { db, auth } from '@/firebase/config'
import Avatar from '@/components/common/Avatar.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'

interface Emits {
  (e: 'close'): void
  (e: 'saved', message: string): void
}

const emit = defineEmits<Emits>()

const authStore = useAuthStore()
const { userProfile } = storeToRefs(authStore)

const displayName = ref(userProfile.value?.displayName || '')
const isSaving = ref(false)
const errorMessage = ref('')

const email = computed(() => auth.currentUser?.email || '')

const isValid = computed(() => {
  return displayName.value.trim().length >= 2
})

const hasChanges = computed(() => {
  return displayName.value.trim() !== userProfile.value?.displayName
})

async function handleSave() {
  if (!isValid.value || !hasChanges.value || !userProfile.value) return

  isSaving.value = true
  errorMessage.value = ''

  try {
    const userRef = doc(db, 'users', userProfile.value.uid)
    await updateDoc(userRef, {
      displayName: displayName.value.trim(),
      updatedAt: serverTimestamp(),
    })

    emit('saved', 'プロフィールを更新しました')
    emit('close')
  } catch (error) {
    errorMessage.value = '更新に失敗しました'
    console.error('Error updating profile:', error)
  } finally {
    isSaving.value = false
  }
}

function handleCancel() {
  displayName.value = userProfile.value?.displayName || ''
  emit('close')
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <!-- オーバーレイ -->
    <div
      class="absolute inset-0 bg-black/50"
      @click="emit('close')"
    />

    <!-- モーダル -->
    <div class="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6">
      <h2 class="text-xl font-bold mb-6">プロフィール編集</h2>

      <!-- アバター -->
      <div class="flex justify-center mb-6">
        <Avatar
          :src="userProfile?.photoURL"
          :name="userProfile?.displayName"
          size="xl"
        />
      </div>

      <!-- メールアドレス（読み取り専用） -->
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-700 mb-1">
          メールアドレス
        </label>
        <p class="text-gray-600">{{ email }}</p>
      </div>

      <!-- 表示名 -->
      <div class="mb-6">
        <label
          for="displayName"
          class="block text-sm font-medium text-gray-700 mb-1"
        >
          表示名
        </label>
        <input
          id="displayName"
          v-model="displayName"
          type="text"
          class="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#601B61] focus:border-transparent"
          placeholder="表示名を入力"
          :disabled="isSaving"
        />
        <p class="mt-1 text-xs text-gray-500">2文字以上で入力してください</p>
      </div>

      <!-- エラーメッセージ -->
      <div
        v-if="errorMessage"
        class="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm"
      >
        {{ errorMessage }}
      </div>

      <!-- ボタン -->
      <div class="flex gap-3">
        <button
          type="button"
          class="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
          :disabled="isSaving"
          @click="handleCancel"
        >
          キャンセル
        </button>
        <button
          type="button"
          class="flex-1 px-4 py-2 text-white bg-[#601B61] hover:bg-opacity-90 rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          :disabled="!isValid || !hasChanges || isSaving"
          @click="handleSave"
        >
          <LoadingSpinner v-if="isSaving" size="sm" color="text-white" />
          <span>{{ isSaving ? '保存中...' : '保存' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
