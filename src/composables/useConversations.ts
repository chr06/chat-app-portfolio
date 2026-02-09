import { ref, readonly } from 'vue'
import {
  collection,
  doc,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  getDocs,
  updateDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
} from 'firebase/firestore'
import { db, auth } from '@/firebase/config'
import type { Conversation, User, ParticipantDetail } from '@/types'

// テストユーザーからのウェルカムメッセージ
const WELCOME_MESSAGE = 'はじめまして！テストユーザーです。\nお好きなメッセージを入力して、チャットを体験してみてください。'

// シングルトンパターン: 全インスタンスで状態を共有
const conversations = ref<Conversation[]>([])
const isLoading = ref(false)
const error = ref<Error | null>(null)
let unsubscribe: (() => void) | null = null

export function useConversations() {

  /**
   * 会話一覧をリアルタイムで監視
   */
  function subscribeToConversations(userId: string) {
    isLoading.value = true

    const conversationsRef = collection(db, 'conversations')
    const q = query(
      conversationsRef,
      where('participants', 'array-contains', userId),
      orderBy('updatedAt', 'desc')
    )

    unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        // 非表示にした会話を除外
        conversations.value = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .filter((conv) => {
            const hiddenBy = (conv as Conversation).hiddenBy || []
            return !hiddenBy.includes(userId)
          }) as Conversation[]
        isLoading.value = false
      },
      (err) => {
        error.value = err
        isLoading.value = false
        console.error('Error fetching conversations:', err)
      }
    )
  }

  /**
   * 監視を停止
   */
  function unsubscribeFromConversations() {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
  }

  /**
   * 特定ユーザーとの既存会話を検索
   */
  async function findExistingConversation(
    otherUserId: string
  ): Promise<Conversation | null> {
    const currentUserId = auth.currentUser?.uid
    if (!currentUserId) return null

    const conversationsRef = collection(db, 'conversations')
    const q = query(
      conversationsRef,
      where('participants', 'array-contains', currentUserId)
    )

    const snapshot = await getDocs(q)

    for (const doc of snapshot.docs) {
      const data = doc.data()
      if (
        data.participants.includes(otherUserId) &&
        data.participants.length === 2
      ) {
        return { id: doc.id, ...data } as Conversation
      }
    }

    return null
  }

  /**
   * テストユーザーからウェルカムメッセージを送信
   */
  async function addWelcomeMessage(
    conversationId: string,
    testUser: User
  ): Promise<void> {
    const messageData = {
      senderId: testUser.uid,
      text: WELCOME_MESSAGE,
      reactions: {},
      createdAt: serverTimestamp(),
    }

    await addDoc(
      collection(db, 'conversations', conversationId, 'messages'),
      messageData
    )

    await updateDoc(doc(db, 'conversations', conversationId), {
      lastMessage: {
        text: WELCOME_MESSAGE,
        senderId: testUser.uid,
        createdAt: serverTimestamp(),
      },
      updatedAt: serverTimestamp(),
    })
  }

  /**
   * 新規会話を作成
   */
  async function createConversation(
    currentUser: User,
    otherUser: User
  ): Promise<string> {
    const participantDetails: Record<string, ParticipantDetail> = {
      [currentUser.uid]: {
        displayName: currentUser.displayName,
        photoURL: currentUser.photoURL,
      },
      [otherUser.uid]: {
        displayName: otherUser.displayName,
        photoURL: otherUser.photoURL,
      },
    }

    const conversationData = {
      participants: [currentUser.uid, otherUser.uid],
      participantDetails,
      lastMessage: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }

    const docRef = await addDoc(
      collection(db, 'conversations'),
      conversationData
    )

    // テストユーザーとの会話の場合、ウェルカムメッセージを追加
    if (otherUser.isTestUser) {
      await addWelcomeMessage(docRef.id, otherUser)
    }

    return docRef.id
  }

  /**
   * 既存会話を取得するか、なければ新規作成
   */
  async function getOrCreateConversation(
    currentUser: User,
    otherUser: User
  ): Promise<string> {
    // 既存会話を検索
    const existing = await findExistingConversation(otherUser.uid)
    if (existing) {
      // 非表示になっている場合は解除
      if (existing.hiddenBy?.includes(currentUser.uid)) {
        await unhideConversation(existing.id)
      }
      // メッセージが実際に存在しない場合、テストユーザーからウェルカムメッセージを送信
      if (otherUser.isTestUser) {
        const messagesRef = collection(db, 'conversations', existing.id, 'messages')
        const messagesSnapshot = await getDocs(query(messagesRef, limit(1)))
        if (messagesSnapshot.empty) {
          await addWelcomeMessage(existing.id, otherUser)
        }
      }
      return existing.id
    }

    // なければ新規作成
    return createConversation(currentUser, otherUser)
  }

  /**
   * 会話の非表示を解除する
   */
  async function unhideConversation(conversationId: string): Promise<void> {
    const currentUserId = auth.currentUser?.uid
    if (!currentUserId) return

    try {
      const conversationRef = doc(db, 'conversations', conversationId)
      await updateDoc(conversationRef, {
        hiddenBy: arrayRemove(currentUserId),
      })
    } catch (e) {
      error.value = e as Error
      console.error('Error unhiding conversation:', e)
      throw e
    }
  }

  /**
   * 会話から相手のユーザー情報を取得
   */
  function getOtherParticipant(
    conversation: Conversation,
    currentUserId: string
  ): ParticipantDetail | null {
    const otherUserId = conversation.participants.find(
      (id) => id !== currentUserId
    )
    if (!otherUserId) return null

    return conversation.participantDetails[otherUserId] || null
  }

  /**
   * 会話IDから会話を直接取得
   */
  async function getConversationById(
    conversationId: string
  ): Promise<Conversation | null> {
    try {
      const conversationRef = doc(db, 'conversations', conversationId)
      const conversationDoc = await getDoc(conversationRef)

      if (!conversationDoc.exists()) return null

      return {
        id: conversationDoc.id,
        ...conversationDoc.data(),
      } as Conversation
    } catch (e) {
      console.error('Error fetching conversation:', e)
      return null
    }
  }

  /**
   * 会話を非表示にする
   */
  async function hideConversation(conversationId: string): Promise<void> {
    const currentUserId = auth.currentUser?.uid
    if (!currentUserId) return

    try {
      const conversationRef = doc(db, 'conversations', conversationId)
      await updateDoc(conversationRef, {
        hiddenBy: arrayUnion(currentUserId),
      })
    } catch (e) {
      error.value = e as Error
      console.error('Error hiding conversation:', e)
      throw e
    }
  }

  return {
    conversations,
    isLoading: readonly(isLoading),
    error: readonly(error),
    subscribeToConversations,
    unsubscribeFromConversations,
    findExistingConversation,
    createConversation,
    getOrCreateConversation,
    getOtherParticipant,
    getConversationById,
    hideConversation,
    unhideConversation,
  }
}
