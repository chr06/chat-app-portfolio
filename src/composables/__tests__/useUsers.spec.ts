import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createMockQuerySnapshot,
  createMockDocumentSnapshot,
} from '@/__tests__/helpers/firebaseMocks'

const mockGetDocs = vi.fn()
const mockGetDoc = vi.fn()

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'mock-collection-ref'),
  query: vi.fn(() => 'mock-query'),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  doc: vi.fn(() => 'mock-doc-ref'),
}))

vi.mock('@/firebase/config', () => ({
  db: {},
  auth: { currentUser: { uid: 'current-uid' } },
}))

describe('useUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  async function loadUseUsers() {
    const mod = await import('../useUsers')
    return mod.useUsers()
  }

  describe('searchUsersByDisplayName', () => {
    it('空文字列の場合は空配列を返す', async () => {
      const { searchUsersByDisplayName } = await loadUseUsers()
      const result = await searchUsersByDisplayName('')
      expect(result).toEqual([])
      expect(mockGetDocs).not.toHaveBeenCalled()
    })

    it('スペースのみの場合は空配列を返す', async () => {
      const { searchUsersByDisplayName } = await loadUseUsers()
      const result = await searchUsersByDisplayName('   ')
      expect(result).toEqual([])
    })

    it('検索語でフィルタリングする', async () => {
      mockGetDocs.mockResolvedValue(
        createMockQuerySnapshot([
          {
            id: 'user-1',
            data: {
              displayName: 'テストユーザー1',
              photoURL: 'https://example.com/1.jpg',
              status: 'approved',
              isTestUser: true,
            },
          },
          {
            id: 'user-2',
            data: {
              displayName: 'テストユーザー2',
              photoURL: 'https://example.com/2.jpg',
              status: 'approved',
              isTestUser: true,
            },
          },
          {
            id: 'user-3',
            data: {
              displayName: '別のユーザー',
              photoURL: 'https://example.com/3.jpg',
              status: 'approved',
              isTestUser: true,
            },
          },
        ]),
      )

      const { searchUsersByDisplayName } = await loadUseUsers()
      const result = await searchUsersByDisplayName('テスト')

      expect(result).toHaveLength(2)
      expect(result[0]!.displayName).toBe('テストユーザー1')
      expect(result[1]!.displayName).toBe('テストユーザー2')
    })

    it('エラー時は空配列を返す', async () => {
      mockGetDocs.mockRejectedValue(new Error('Firestore error'))

      const { searchUsersByDisplayName, searchError } = await loadUseUsers()
      const result = await searchUsersByDisplayName('test')

      expect(result).toEqual([])
      expect(searchError.value).toBeInstanceOf(Error)
    })
  })

  describe('getApprovedUsers', () => {
    it('承認済みテストユーザーを取得し、自分を除外する', async () => {
      mockGetDocs.mockResolvedValue(
        createMockQuerySnapshot([
          {
            id: 'current-uid',
            data: {
              displayName: '自分',
              photoURL: '',
              status: 'approved',
              isTestUser: true,
            },
          },
          {
            id: 'user-2',
            data: {
              displayName: 'ユーザー2',
              photoURL: '',
              status: 'approved',
              isTestUser: true,
            },
          },
          {
            id: 'user-3',
            data: {
              displayName: 'ユーザー3',
              photoURL: '',
              status: 'pending',
              isTestUser: true,
            },
          },
        ]),
      )

      const { getApprovedUsers } = await loadUseUsers()
      const result = await getApprovedUsers()

      // 自分(current-uid)と pending(user-3) は除外
      expect(result).toHaveLength(1)
      expect(result[0]!.uid).toBe('user-2')
    })

    it('isSearching が正しく切り替わる', async () => {
      let resolveGetDocs: (value: unknown) => void
      mockGetDocs.mockReturnValue(
        new Promise((resolve) => {
          resolveGetDocs = resolve
        }),
      )

      const { getApprovedUsers, isSearching } = await loadUseUsers()

      expect(isSearching.value).toBe(false)

      const promise = getApprovedUsers()
      expect(isSearching.value).toBe(true)

      resolveGetDocs!(createMockQuerySnapshot([]))
      await promise

      expect(isSearching.value).toBe(false)
    })
  })

  describe('getUserById', () => {
    it('存在するユーザーを返す', async () => {
      mockGetDoc.mockResolvedValue(
        createMockDocumentSnapshot('user-1', {
          displayName: 'テストユーザー1',
          photoURL: '',
          status: 'approved',
        }),
      )

      const { getUserById } = await loadUseUsers()
      const result = await getUserById('user-1')

      expect(result).toMatchObject({
        uid: 'user-1',
        displayName: 'テストユーザー1',
      })
    })

    it('存在しないユーザーは null を返す', async () => {
      mockGetDoc.mockResolvedValue(createMockDocumentSnapshot('user-1', null))

      const { getUserById } = await loadUseUsers()
      const result = await getUserById('user-1')

      expect(result).toBeNull()
    })

    it('エラー時は null を返す', async () => {
      mockGetDoc.mockRejectedValue(new Error('Firestore error'))

      const { getUserById } = await loadUseUsers()
      const result = await getUserById('user-1')

      expect(result).toBeNull()
    })
  })
})
