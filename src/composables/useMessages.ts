import { ref, readonly, type Ref, watch } from 'vue'
import {
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  getDocs,
  getDoc,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore'
import { db, auth } from '@/firebase/config'
import type { Message } from '@/types'

const PAGE_SIZE = 20

export function useMessages(conversationId: Ref<string | undefined>) {
  const messages = ref<Message[]>([])
  const isLoading = ref(false)
  const isLoadingMore = ref(false)
  const hasMore = ref(true)
  const error = ref<Error | null>(null)

  let unsubscribe: (() => void) | null = null
  let lastDoc: QueryDocumentSnapshot<DocumentData> | null = null

  /**
   * メッセージをリアルタイムで監視（最新のPAGE_SIZE件）
   */
  function subscribeToMessages() {
    const convId = conversationId.value
    if (!convId) return

    isLoading.value = true

    const messagesRef = collection(db, 'conversations', convId, 'messages')
    const q = query(
      messagesRef,
      orderBy('createdAt', 'desc'),
      limit(PAGE_SIZE)
    )

    unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const newMessages = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Message[]

        // 降順で取得しているので反転して古い順にする
        messages.value = [...newMessages].reverse()

        // 最後のドキュメントを保存（追加読み込み用）
        lastDoc = snapshot.docs[snapshot.docs.length - 1] || null
        hasMore.value = snapshot.docs.length === PAGE_SIZE

        isLoading.value = false
      },
      (err) => {
        error.value = err
        isLoading.value = false
        console.error('Error fetching messages:', err)
      }
    )
  }

  /**
   * 監視を停止
   */
  function unsubscribeFromMessages() {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
    messages.value = []
    lastDoc = null
    hasMore.value = true
  }

  /**
   * 追加のメッセージを読み込み（古いメッセージ）
   */
  async function loadMoreMessages() {
    const convId = conversationId.value
    if (!convId || !hasMore.value || isLoadingMore.value || !lastDoc) return

    isLoadingMore.value = true

    try {
      const messagesRef = collection(db, 'conversations', convId, 'messages')
      const q = query(
        messagesRef,
        orderBy('createdAt', 'desc'),
        startAfter(lastDoc),
        limit(PAGE_SIZE)
      )

      const snapshot = await getDocs(q)
      const olderMessages = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Message[]

      // 古いメッセージを先頭に追加
      messages.value = [...olderMessages.reverse(), ...messages.value]

      lastDoc = snapshot.docs[snapshot.docs.length - 1] || null
      hasMore.value = snapshot.docs.length === PAGE_SIZE
    } catch (e) {
      error.value = e as Error
      console.error('Error loading more messages:', e)
    } finally {
      isLoadingMore.value = false
    }
  }

  /**
   * テキストメッセージを送信
   */
  async function sendMessage(text: string) {
    const convId = conversationId.value
    const currentUser = auth.currentUser
    if (!convId || !currentUser || !text.trim()) return

    try {
      const messageData = {
        senderId: currentUser.uid,
        text: text.trim(),
        reactions: {},
        createdAt: serverTimestamp(),
      }

      // メッセージを追加
      await addDoc(
        collection(db, 'conversations', convId, 'messages'),
        messageData
      )

      // 会話の lastMessage と updatedAt を更新
      await updateDoc(doc(db, 'conversations', convId), {
        lastMessage: {
          text: text.trim(),
          senderId: currentUser.uid,
          createdAt: serverTimestamp(),
        },
        updatedAt: serverTimestamp(),
      })
    } catch (e) {
      error.value = e as Error
      console.error('Error sending message:', e)
      throw e
    }
  }

  /**
   * 画像付きメッセージを送信
   */
  async function sendImageMessage(imageUrl: string, imagePath: string, text: string = '') {
    const convId = conversationId.value
    const currentUser = auth.currentUser
    if (!convId || !currentUser) return

    try {
      const messageData = {
        senderId: currentUser.uid,
        text,
        imageUrl,
        imagePath,
        reactions: {},
        createdAt: serverTimestamp(),
      }

      await addDoc(
        collection(db, 'conversations', convId, 'messages'),
        messageData
      )

      await updateDoc(doc(db, 'conversations', convId), {
        lastMessage: {
          text: text || '画像を送信しました',
          senderId: currentUser.uid,
          createdAt: serverTimestamp(),
        },
        updatedAt: serverTimestamp(),
      })
    } catch (e) {
      error.value = e as Error
      console.error('Error sending image message:', e)
      throw e
    }
  }

  /**
   * メッセージにリアクションを追加
   */
  async function addReaction(messageId: string, emoji: string) {
    const convId = conversationId.value
    const currentUser = auth.currentUser
    if (!convId || !currentUser) return

    try {
      const messageRef = doc(
        db,
        'conversations',
        convId,
        'messages',
        messageId
      )

      // 現在のリアクションを取得
      const messageDoc = await getDoc(messageRef)
      if (!messageDoc.exists()) return

      const reactions = messageDoc.data().reactions || {}
      const currentReactions = reactions[emoji] || []

      // すでにリアクション済みなら何もしない
      if (currentReactions.includes(currentUser.uid)) return

      // リアクションを追加
      await updateDoc(messageRef, {
        [`reactions.${emoji}`]: arrayUnion(currentUser.uid),
      })
    } catch (e) {
      error.value = e as Error
      console.error('Error adding reaction:', e)
    }
  }

  /**
   * メッセージからリアクションを削除
   */
  async function removeReaction(messageId: string, emoji: string) {
    const convId = conversationId.value
    const currentUser = auth.currentUser
    if (!convId || !currentUser) return

    try {
      const messageRef = doc(
        db,
        'conversations',
        convId,
        'messages',
        messageId
      )

      await updateDoc(messageRef, {
        [`reactions.${emoji}`]: arrayRemove(currentUser.uid),
      })
    } catch (e) {
      error.value = e as Error
      console.error('Error removing reaction:', e)
    }
  }

  // conversationId が変わったらリスナーを再設定
  watch(
    conversationId,
    (newId, oldId) => {
      if (oldId) {
        unsubscribeFromMessages()
      }
      if (newId) {
        subscribeToMessages()
      }
    },
    { immediate: true }
  )

  return {
    messages,
    isLoading: readonly(isLoading),
    isLoadingMore: readonly(isLoadingMore),
    hasMore: readonly(hasMore),
    error: readonly(error),
    loadMoreMessages,
    sendMessage,
    sendImageMessage,
    addReaction,
    removeReaction,
    unsubscribeFromMessages,
  }
}
