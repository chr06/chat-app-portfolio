import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createMockQuerySnapshot,
  createMockDocumentSnapshot,
  createMockTimestamp,
  createMockOnSnapshot,
} from '@/__tests__/helpers/firebaseMocks'
import type { Conversation, ParticipantDetail } from '@/types'

const mockGetDocs = vi.fn()
const mockGetDoc = vi.fn()
const mockAddDoc = vi.fn()
const mockUpdateDoc = vi.fn()
const { mock: mockOnSnapshot, unsubscribe: mockUnsubscribe, triggerSnapshot } =
  createMockOnSnapshot()

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'mock-collection-ref'),
  doc: vi.fn(() => 'mock-doc-ref'),
  query: vi.fn(() => 'mock-query'),
  where: vi.fn(),
  orderBy: vi.fn(),
  getDocs: (...args: unknown[]) => mockGetDocs(...(args as [])),
  getDoc: (...args: unknown[]) => mockGetDoc(...(args as [])),
  addDoc: (...args: unknown[]) => mockAddDoc(...(args as [])),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...(args as [])),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...(args as [])),
  serverTimestamp: vi.fn(() => 'mock-server-timestamp'),
  arrayUnion: vi.fn((val: string) => ({ type: 'arrayUnion', value: val })),
  arrayRemove: vi.fn((val: string) => ({ type: 'arrayRemove', value: val })),
}))

vi.mock('@/firebase/config', () => ({
  db: {},
  auth: { currentUser: { uid: 'current-uid' } },
}))

describe('useConversations', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    // シングルトン状態をリセットするために vi.resetModules を使用
    vi.resetModules()

    // 再度 mock を設定（resetModules 後に必要）
    vi.doMock('firebase/firestore', () => ({
      collection: vi.fn(() => 'mock-collection-ref'),
      doc: vi.fn(() => 'mock-doc-ref'),
      query: vi.fn(() => 'mock-query'),
      where: vi.fn(),
      orderBy: vi.fn(),
      getDocs: (...args: unknown[]) => mockGetDocs(...(args as [])),
      getDoc: (...args: unknown[]) => mockGetDoc(...(args as [])),
      addDoc: (...args: unknown[]) => mockAddDoc(...(args as [])),
      updateDoc: (...args: unknown[]) => mockUpdateDoc(...(args as [])),
      onSnapshot: (...args: unknown[]) => mockOnSnapshot(...(args as [])),
      serverTimestamp: vi.fn(() => 'mock-server-timestamp'),
      arrayUnion: vi.fn((val: string) => ({ type: 'arrayUnion', value: val })),
      arrayRemove: vi.fn((val: string) => ({ type: 'arrayRemove', value: val })),
    }))

    vi.doMock('@/firebase/config', () => ({
      db: {},
      auth: { currentUser: { uid: 'current-uid' } },
    }))
  })

  async function loadUseConversations() {
    const mod = await import('../useConversations')
    return mod.useConversations()
  }

  describe('subscribeToConversations', () => {
    it('onSnapshot を呼び出してリスナーを設定する', async () => {
      const { subscribeToConversations } = await loadUseConversations()
      subscribeToConversations('current-uid')

      expect(mockOnSnapshot).toHaveBeenCalled()
    })

    it('スナップショットから会話を設定する（非表示を除外）', async () => {
      const { subscribeToConversations, conversations } = await loadUseConversations()
      subscribeToConversations('current-uid')

      const now = createMockTimestamp()
      triggerSnapshot({
        docs: [
          {
            id: 'conv-1',
            data: () => ({
              participants: ['current-uid', 'other-uid'],
              participantDetails: {},
              lastMessage: null,
              hiddenBy: [],
              updatedAt: now,
            }),
          },
          {
            id: 'conv-2',
            data: () => ({
              participants: ['current-uid', 'another-uid'],
              participantDetails: {},
              lastMessage: null,
              hiddenBy: ['current-uid'], // 非表示
              updatedAt: now,
            }),
          },
        ],
      })

      expect(conversations.value).toHaveLength(1)
      expect(conversations.value[0]!.id).toBe('conv-1')
    })
  })

  describe('unsubscribeFromConversations', () => {
    it('リスナーを解除する', async () => {
      const { subscribeToConversations, unsubscribeFromConversations } =
        await loadUseConversations()
      subscribeToConversations('current-uid')
      unsubscribeFromConversations()

      expect(mockUnsubscribe).toHaveBeenCalled()
    })
  })

  describe('findExistingConversation', () => {
    it('既存の会話を見つける', async () => {
      mockGetDocs.mockResolvedValue(
        createMockQuerySnapshot([
          {
            id: 'conv-1',
            data: {
              participants: ['current-uid', 'other-uid'],
              participantDetails: {},
              lastMessage: null,
            },
          },
        ]),
      )

      const { findExistingConversation } = await loadUseConversations()
      const result = await findExistingConversation('other-uid')

      expect(result).not.toBeNull()
      expect(result!.id).toBe('conv-1')
    })

    it('会話が見つからない場合は null を返す', async () => {
      mockGetDocs.mockResolvedValue(createMockQuerySnapshot([]))

      const { findExistingConversation } = await loadUseConversations()
      const result = await findExistingConversation('nonexistent-uid')

      expect(result).toBeNull()
    })
  })

  describe('createConversation', () => {
    it('新規会話を作成する', async () => {
      mockAddDoc.mockResolvedValue({ id: 'new-conv-id' })
      mockUpdateDoc.mockResolvedValue(undefined)

      const { createConversation } = await loadUseConversations()
      const now = createMockTimestamp()
      const currentUser = {
        uid: 'current-uid',
        displayName: 'Current User',
        photoURL: '',
        status: 'approved' as const,
        createdAt: now,
        updatedAt: now,
      }
      const otherUser = {
        uid: 'other-uid',
        displayName: 'Other User',
        photoURL: '',
        status: 'approved' as const,
        isTestUser: false,
        createdAt: now,
        updatedAt: now,
      }

      const result = await createConversation(currentUser as unknown as import('@/types').User, otherUser as unknown as import('@/types').User)

      expect(result).toBe('new-conv-id')
      expect(mockAddDoc).toHaveBeenCalledOnce()
    })

    it('テストユーザーとの会話ではウェルカムメッセージを追加する', async () => {
      mockAddDoc.mockResolvedValue({ id: 'new-conv-id' })
      mockUpdateDoc.mockResolvedValue(undefined)

      const { createConversation } = await loadUseConversations()
      const now = createMockTimestamp()
      const currentUser = {
        uid: 'current-uid',
        displayName: 'Current User',
        photoURL: '',
        status: 'approved' as const,
        createdAt: now,
        updatedAt: now,
      }
      const testUser = {
        uid: 'test-uid',
        displayName: 'Test User',
        photoURL: '',
        status: 'approved' as const,
        isTestUser: true,
        createdAt: now,
        updatedAt: now,
      }

      await createConversation(currentUser as unknown as import('@/types').User, testUser as unknown as import('@/types').User)

      // 会話作成 + メッセージ追加 = 2回の addDoc
      expect(mockAddDoc).toHaveBeenCalledTimes(2)
      // lastMessage の更新
      expect(mockUpdateDoc).toHaveBeenCalled()
    })
  })

  describe('getOtherParticipant', () => {
    it('相手の参加者情報を返す', async () => {
      const { getOtherParticipant } = await loadUseConversations()

      const conversation = {
        id: 'conv-1',
        participants: ['current-uid', 'other-uid'],
        participantDetails: {
          'current-uid': { displayName: 'Me', photoURL: '' },
          'other-uid': { displayName: 'Other', photoURL: 'https://example.com/photo.jpg' },
        } as Record<string, ParticipantDetail>,
        lastMessage: null,
        createdAt: createMockTimestamp(),
        updatedAt: createMockTimestamp(),
      } as unknown as Conversation

      const result = getOtherParticipant(conversation, 'current-uid')

      expect(result).toEqual({
        displayName: 'Other',
        photoURL: 'https://example.com/photo.jpg',
      })
    })

    it('相手が見つからない場合は null を返す', async () => {
      const { getOtherParticipant } = await loadUseConversations()

      const conversation = {
        id: 'conv-1',
        participants: ['current-uid'],
        participantDetails: {
          'current-uid': { displayName: 'Me', photoURL: '' },
        } as Record<string, ParticipantDetail>,
        lastMessage: null,
        createdAt: createMockTimestamp(),
        updatedAt: createMockTimestamp(),
      } as unknown as Conversation

      const result = getOtherParticipant(conversation, 'current-uid')

      expect(result).toBeNull()
    })
  })

  describe('getConversationById', () => {
    it('会話を取得する', async () => {
      mockGetDoc.mockResolvedValue(
        createMockDocumentSnapshot('conv-1', {
          participants: ['uid1', 'uid2'],
          participantDetails: {},
          lastMessage: null,
        }),
      )

      const { getConversationById } = await loadUseConversations()
      const result = await getConversationById('conv-1')

      expect(result).not.toBeNull()
      expect(result!.id).toBe('conv-1')
    })

    it('存在しない場合は null を返す', async () => {
      mockGetDoc.mockResolvedValue(createMockDocumentSnapshot('conv-1', null))

      const { getConversationById } = await loadUseConversations()
      const result = await getConversationById('conv-1')

      expect(result).toBeNull()
    })
  })

  describe('hideConversation / unhideConversation', () => {
    it('hideConversation が arrayUnion で呼び出される', async () => {
      mockUpdateDoc.mockResolvedValue(undefined)

      const { hideConversation } = await loadUseConversations()
      await hideConversation('conv-1')

      expect(mockUpdateDoc).toHaveBeenCalledOnce()
    })

    it('unhideConversation が arrayRemove で呼び出される', async () => {
      mockUpdateDoc.mockResolvedValue(undefined)

      const { unhideConversation } = await loadUseConversations()
      await unhideConversation('conv-1')

      expect(mockUpdateDoc).toHaveBeenCalledOnce()
    })
  })
})
