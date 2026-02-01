import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

// ルートメタ情報の型定義
declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    requiresApproval?: boolean
    guestOnly?: boolean
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/chat',
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { guestOnly: true },
    },
    {
      path: '/pending',
      name: 'pending',
      component: () => import('@/views/PendingApprovalView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/chat',
      name: 'chat',
      component: () => import('@/views/ChatView.vue'),
      meta: { requiresAuth: true, requiresApproval: true },
    },
    {
      path: '/chat/:conversationId',
      name: 'conversation',
      component: () => import('@/views/ChatView.vue'),
      meta: { requiresAuth: true, requiresApproval: true },
    },
  ],
})

router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore()

  // 認証状態の読み込みを待つ
  if (authStore.isLoading) {
    await new Promise<void>((resolve) => {
      const unwatch = authStore.$subscribe((_mutation, state) => {
        if (!state.isLoading) {
          unwatch()
          resolve()
        }
      })
    })
  }

  const isAuthenticated = authStore.isAuthenticated
  const isApproved = authStore.isApproved

  // 認証が必要なページ
  if (to.meta.requiresAuth && !isAuthenticated) {
    return next({ name: 'login' })
  }

  // 承認が必要なページ
  if (to.meta.requiresApproval && !isApproved) {
    return next({ name: 'pending' })
  }

  // ゲスト専用ページ（認証済みならリダイレクト）
  if (to.meta.guestOnly && isAuthenticated) {
    if (isApproved) {
      return next({ name: 'chat' })
    } else {
      return next({ name: 'pending' })
    }
  }

  // 承認待ちページに承認済みユーザーがアクセス
  if (to.name === 'pending' && isApproved) {
    return next({ name: 'chat' })
  }

  next()
})

export default router
