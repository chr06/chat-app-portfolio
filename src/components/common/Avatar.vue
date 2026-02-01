<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  src?: string | null
  name?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  showOnline?: boolean
  isOnline?: boolean
  showBorder?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  src: null,
  name: '',
  size: 'md',
  showOnline: false,
  isOnline: false,
  showBorder: true,
})

const sizeClasses = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
}

const onlineIndicatorSize = {
  xs: 'w-1.5 h-1.5',
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3 h-3',
  xl: 'w-4 h-4',
}

const initials = computed(() => {
  if (!props.name) return '?'
  return props.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
})

// 名前からランダムな背景色を生成
const bgColor = computed(() => {
  const colors = [
    'bg-red-500',
    'bg-orange-500',
    'bg-amber-500',
    'bg-yellow-500',
    'bg-lime-500',
    'bg-green-500',
    'bg-emerald-500',
    'bg-teal-500',
    'bg-cyan-500',
    'bg-sky-500',
    'bg-blue-500',
    'bg-indigo-500',
    'bg-violet-500',
    'bg-purple-500',
    'bg-fuchsia-500',
    'bg-pink-500',
  ]

  if (!props.name) return colors[0]

  let hash = 0
  for (let i = 0; i < props.name.length; i++) {
    hash = props.name.charCodeAt(i) + ((hash << 5) - hash)
  }

  return colors[Math.abs(hash) % colors.length]
})
</script>

<template>
  <div class="relative inline-block">
    <!-- 画像がある場合 -->
    <img
      v-if="src"
      :src="src"
      :alt="name"
      :class="[sizeClasses[size], showBorder ? 'ring-1 ring-gray-200' : '']"
      class="rounded-full object-cover"
    />

    <!-- 画像がない場合（イニシャル表示） -->
    <div
      v-else
      :class="[sizeClasses[size], bgColor, showBorder ? 'ring-1 ring-gray-200' : '']"
      class="rounded-full flex items-center justify-center text-white font-medium"
    >
      {{ initials }}
    </div>

    <!-- オンラインインジケーター -->
    <span
      v-if="showOnline"
      :class="[
        onlineIndicatorSize[size],
        isOnline ? 'bg-green-500' : 'bg-gray-400',
      ]"
      class="absolute bottom-0 right-0 rounded-full ring-2 ring-white"
    />
  </div>
</template>
