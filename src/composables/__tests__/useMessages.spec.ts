import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'
import {
  createMockOnSnapshot,
  createMockDocumentSnapshot,
} from '@/__tests__/helpers/firebaseMocks'

const mockAddDoc = vi.fn()
const mockUpdateDoc = vi.fn()
const mockGetDocs = vi.fn()
const mockGetDoc = vi.fn()
const {
  mock: mockOnSnapshot,
  unsubscribe: mockUnsubscribe,
  triggerSnapshot,
} = createMockOnSnapshot()

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'mock-collection-ref'),
  doc: vi.fn(() => 'mock-doc-ref'),
  query: vi.fn(() => 'mock-query'),
  orderBy: vi.fn(),
  limit: vi.fn(),
  startAfter: vi.fn(),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  serverTimestamp: vi.fn(() => 'mock-server-timestamp'),
  arrayUnion: vi.fn((val: string) => ({ type: 'arrayUnion', value: val })),
  arrayRemove: vi.fn((val: string) => ({ type: 'arrayRemove', value: val })),
}))

vi.mock('@/firebase/config', () => ({
  db: {},
  auth: { currentUser: { uid: 'current-uid' } },
}))

describe('useMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  async function loadUseMessages(convId?: string) {
    const mod = await import('../useMessages')
    const conversationId = ref<string | undefined>(convId)
    const result = mod.useMessages(conversationId)
    await nextTick()
    return { ...result, conversationId }
  }

  describe('初期化', () => {
    it('conversationId があれば即座に subscribe する', async () => {
      await loadUseMessages('conv-1')
      expect(mockOnSnapshot).toHaveBeenCalled()
    })

    it('conversationId が undefined なら subscribe しない', async () => {
      await loadUseMessages(undefined)
      expect(mockOnSnapshot).not.toHaveBeenCalled()
    })
  })

  describe('subscribeToMessages', () => {
    it('スナップショットからメッセージを設定する（降順→昇順に反転）', async () => {
      const { messages } = await loadUseMessages('conv-1')

      triggerSnapshot({
        docs: [
          {
            id: 'msg-2',
            data: () => ({
              senderId: 'user-1',
              text: 'Second',
              reactions: {},
              createdAt: { toDate: () => new Date('2024-01-01T00:01:00') },
            }),
          },
          {
            id: 'msg-1',
            data: () => ({
              senderId: 'user-1',
              text: 'First',
              reactions: {},
              createdAt: { toDate: () => new Date('2024-01-01T00:00:00') },
            }),
          },
        ],
      })

      // 降順のスナップショットを昇順に反転
      expect(messages.value).toHaveLength(2)
      expect(messages.value[0].id).toBe('msg-1')
      expect(messages.value[1].id).toBe('msg-2')
    })

    it('hasMore が PAGE_SIZE 未満で false になる', async () => {
      const { hasMore } = await loadUseMessages('conv-1')

      triggerSnapshot({
        docs: [
          {
            id: 'msg-1',
            data: () => ({ senderId: 'u', text: 't', reactions: {} }),
          },
        ],
      })

      expect(hasMore.value).toBe(false)
    })
  })

  describe('conversationId の watch', () => {
    it('conversationId が変わるとリスナーを再設定する', async () => {
      const { conversationId } = await loadUseMessages('conv-1')
      expect(mockOnSnapshot).toHaveBeenCalledTimes(1)

      conversationId.value = 'conv-2'
      await nextTick()

      // unsubscribe + 新しい subscribe
      expect(mockUnsubscribe).toHaveBeenCalled()
      expect(mockOnSnapshot).toHaveBeenCalledTimes(2)
    })

    it('conversationId が undefined に変わるとリスナーを解除する', async () => {
      const { conversationId, messages } = await loadUseMessages('conv-1')

      conversationId.value = undefined
      await nextTick()

      expect(mockUnsubscribe).toHaveBeenCalled()
      expect(messages.value).toEqual([])
    })
  })

  describe('sendMessage', () => {
    it('メッセージを追加してlastMessageを更新する', async () => {
      mockAddDoc.mockResolvedValue({ id: 'new-msg-id' })
      mockUpdateDoc.mockResolvedValue(undefined)

      const { sendMessage } = await loadUseMessages('conv-1')
      await sendMessage('Hello!')

      expect(mockAddDoc).toHaveBeenCalledOnce()
      expect(mockUpdateDoc).toHaveBeenCalledOnce()

      // addDoc の引数を確認
      const addDocData = mockAddDoc.mock.calls[0][1]
      expect(addDocData).toMatchObject({
        senderId: 'current-uid',
        text: 'Hello!',
        reactions: {},
      })
    })

    it('空白のみのメッセージは送信しない', async () => {
      const { sendMessage } = await loadUseMessages('conv-1')
      await sendMessage('   ')

      expect(mockAddDoc).not.toHaveBeenCalled()
    })

    it('conversationId がない場合は送信しない', async () => {
      const { sendMessage } = await loadUseMessages(undefined)
      await sendMessage('Hello!')

      expect(mockAddDoc).not.toHaveBeenCalled()
    })

    it('エラー時に error を設定して throw する', async () => {
      mockAddDoc.mockRejectedValue(new Error('Send failed'))

      const { sendMessage, error } = await loadUseMessages('conv-1')

      await expect(sendMessage('Hello!')).rejects.toThrow('Send failed')
      expect(error.value).toBeInstanceOf(Error)
    })
  })

  describe('sendImageMessage', () => {
    it('画像メッセージを送信する', async () => {
      mockAddDoc.mockResolvedValue({ id: 'img-msg-id' })
      mockUpdateDoc.mockResolvedValue(undefined)

      const { sendImageMessage } = await loadUseMessages('conv-1')
      await sendImageMessage('https://example.com/img.jpg', 'images/uid/file.jpg', 'caption')

      expect(mockAddDoc).toHaveBeenCalledOnce()
      const addDocData = mockAddDoc.mock.calls[0][1]
      expect(addDocData).toMatchObject({
        senderId: 'current-uid',
        text: 'caption',
        imageUrl: 'https://example.com/img.jpg',
        imagePath: 'images/uid/file.jpg',
      })
    })

    it('テキストなしの場合、lastMessage に "画像を送信しました" を使う', async () => {
      mockAddDoc.mockResolvedValue({ id: 'img-msg-id' })
      mockUpdateDoc.mockResolvedValue(undefined)

      const { sendImageMessage } = await loadUseMessages('conv-1')
      await sendImageMessage('https://example.com/img.jpg', 'images/uid/file.jpg')

      const updateDocData = mockUpdateDoc.mock.calls[0][1]
      expect(updateDocData.lastMessage.text).toBe('画像を送信しました')
    })
  })

  describe('loadMoreMessages', () => {
    it('追加メッセージをロードして先頭に追加する', async () => {
      const { messages, loadMoreMessages } = await loadUseMessages('conv-1')

      // 初期ロード
      const initialDocs = Array.from({ length: 20 }, (_, i) => ({
        id: `msg-${i}`,
        data: () => ({
          senderId: 'u',
          text: `Message ${i}`,
          reactions: {},
        }),
      }))
      triggerSnapshot({ docs: initialDocs })

      // loadMore
      mockGetDocs.mockResolvedValue({
        docs: [
          {
            id: 'old-msg-1',
            data: () => ({
              senderId: 'u',
              text: 'Old message',
              reactions: {},
            }),
          },
        ],
      })

      await loadMoreMessages()

      // 古いメッセージが先頭に追加される
      expect(messages.value[0].id).toBe('old-msg-1')
    })

    it('hasMore が false の場合はロードしない', async () => {
      const { loadMoreMessages } = await loadUseMessages('conv-1')

      // 20件未満のスナップショット → hasMore = false
      triggerSnapshot({
        docs: [
          { id: 'msg-1', data: () => ({ senderId: 'u', text: 't', reactions: {} }) },
        ],
      })

      await loadMoreMessages()
      expect(mockGetDocs).not.toHaveBeenCalled()
    })
  })

  describe('addReaction', () => {
    it('リアクションを追加する', async () => {
      mockGetDoc.mockResolvedValue(
        createMockDocumentSnapshot('msg-1', { reactions: {} }),
      )
      mockUpdateDoc.mockResolvedValue(undefined)

      const { addReaction } = await loadUseMessages('conv-1')
      await addReaction('msg-1', '👍')

      expect(mockUpdateDoc).toHaveBeenCalled()
    })

    it('既にリアクション済みの場合は何もしない', async () => {
      mockGetDoc.mockResolvedValue(
        createMockDocumentSnapshot('msg-1', {
          reactions: { '👍': ['current-uid'] },
        }),
      )

      const { addReaction } = await loadUseMessages('conv-1')
      await addReaction('msg-1', '👍')

      expect(mockUpdateDoc).not.toHaveBeenCalled()
    })
  })

  describe('removeReaction', () => {
    it('リアクションを削除する', async () => {
      mockUpdateDoc.mockResolvedValue(undefined)

      const { removeReaction } = await loadUseMessages('conv-1')
      await removeReaction('msg-1', '👍')

      expect(mockUpdateDoc).toHaveBeenCalled()
    })
  })

  describe('unsubscribeFromMessages', () => {
    it('リスナーを解除してメッセージをクリアする', async () => {
      const { unsubscribeFromMessages, messages } = await loadUseMessages('conv-1')

      triggerSnapshot({
        docs: [
          { id: 'msg-1', data: () => ({ senderId: 'u', text: 't', reactions: {} }) },
        ],
      })
      expect(messages.value).toHaveLength(1)

      unsubscribeFromMessages()

      expect(mockUnsubscribe).toHaveBeenCalled()
      expect(messages.value).toEqual([])
    })
  })
})
