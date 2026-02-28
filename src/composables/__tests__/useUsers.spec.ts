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
      // 現在のユーザーのワークスペースID取得
      mockGetDoc.mockResolvedValue(
        createMockDocumentSnapshot('current-uid', {
          uid: 'current-uid',
          workspaceId: 'WS-001',
          status: 'approved',
        }),
      )

      // 1回目: テストユーザークエリ, 2回目: ワークスペースユーザークエリ
      mockGetDocs
        .mockResolvedValueOnce(
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
        .mockResolvedValueOnce(createMockQuerySnapshot([]))

      const { searchUsersByDisplayName } = await loadUseUsers()
      const result = await searchUsersByDisplayName('テスト')

      expect(result).toHaveLength(2)
      expect(result[0]!.displayName).toBe('テストユーザー1')
      expect(result[1]!.displayName).toBe('テストユーザー2')
    })

    it('エラー時は空配列を返す', async () => {
      mockGetDoc.mockResolvedValue(
        createMockDocumentSnapshot('current-uid', {
          uid: 'current-uid',
          workspaceId: 'WS-001',
          status: 'approved',
        }),
      )
      mockGetDocs.mockRejectedValue(new Error('Firestore error'))

      const { searchUsersByDisplayName, searchError } = await loadUseUsers()
      const result = await searchUsersByDisplayName('test')

      expect(result).toEqual([])
      expect(searchError.value).toBeInstanceOf(Error)
    })
  })

  describe('getApprovedUsers', () => {
    it('テストユーザーを取得し、自分を除外する', async () => {
      mockGetDoc.mockResolvedValue(
        createMockDocumentSnapshot('current-uid', {
          uid: 'current-uid',
          workspaceId: 'WS-001',
          status: 'approved',
        }),
      )

      mockGetDocs
        .mockResolvedValueOnce(
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
          ]),
        )
        .mockResolvedValueOnce(createMockQuerySnapshot([]))

      const { getApprovedUsers } = await loadUseUsers()
      const result = await getApprovedUsers()

      // 自分(current-uid) は除外
      expect(result).toHaveLength(1)
      expect(result[0]!.uid).toBe('user-2')
    })

    it('テストユーザーと同ワークスペースのユーザーを結合する', async () => {
      mockGetDoc.mockResolvedValue(
        createMockDocumentSnapshot('current-uid', {
          uid: 'current-uid',
          workspaceId: 'WS-001',
          status: 'approved',
        }),
      )

      // 1回目: テストユーザー
      mockGetDocs
        .mockResolvedValueOnce(
          createMockQuerySnapshot([
            {
              id: 'test-user-1',
              data: {
                displayName: 'テストユーザー1',
                photoURL: '',
                status: 'approved',
                isTestUser: true,
              },
            },
          ]),
        )
        // 2回目: 同ワークスペースユーザー
        .mockResolvedValueOnce(
          createMockQuerySnapshot([
            {
              id: 'ws-user-1',
              data: {
                displayName: 'ワークスペースユーザー1',
                photoURL: '',
                status: 'approved',
                workspaceId: 'WS-001',
              },
            },
          ]),
        )

      const { getApprovedUsers } = await loadUseUsers()
      const result = await getApprovedUsers()

      expect(result).toHaveLength(2)
      const names = result.map((u) => u.displayName)
      expect(names).toContain('テストユーザー1')
      expect(names).toContain('ワークスペースユーザー1')
    })

    it('テストユーザーとワークスペースユーザーの重複を排除する', async () => {
      mockGetDoc.mockResolvedValue(
        createMockDocumentSnapshot('current-uid', {
          uid: 'current-uid',
          workspaceId: 'WS-001',
          status: 'approved',
        }),
      )

      mockGetDocs
        .mockResolvedValueOnce(
          createMockQuerySnapshot([
            {
              id: 'user-1',
              data: {
                displayName: 'ユーザー1',
                photoURL: '',
                status: 'approved',
                isTestUser: true,
              },
            },
          ]),
        )
        .mockResolvedValueOnce(
          createMockQuerySnapshot([
            {
              id: 'user-1',
              data: {
                displayName: 'ユーザー1',
                photoURL: '',
                status: 'approved',
                workspaceId: 'WS-001',
              },
            },
          ]),
        )

      const { getApprovedUsers } = await loadUseUsers()
      const result = await getApprovedUsers()

      expect(result).toHaveLength(1)
    })

    it('ワークスペースIDがない場合はテストユーザーのみ返す', async () => {
      mockGetDoc.mockResolvedValue(
        createMockDocumentSnapshot('current-uid', {
          uid: 'current-uid',
          status: 'approved',
          // workspaceId なし
        }),
      )

      mockGetDocs.mockResolvedValueOnce(
        createMockQuerySnapshot([
          {
            id: 'test-user-1',
            data: {
              displayName: 'テストユーザー1',
              photoURL: '',
              status: 'approved',
              isTestUser: true,
            },
          },
        ]),
      )

      const { getApprovedUsers } = await loadUseUsers()
      const result = await getApprovedUsers()

      expect(result).toHaveLength(1)
      expect(result[0]!.displayName).toBe('テストユーザー1')
      // ワークスペースクエリは実行されない
      expect(mockGetDocs).toHaveBeenCalledTimes(1)
    })

    it('未ログイン時は空配列を返す', async () => {
      const config = await import('@/firebase/config')
      const originalUser = config.auth.currentUser
      ;(config.auth as { currentUser: null }).currentUser = null

      const { getApprovedUsers } = await loadUseUsers()
      const result = await getApprovedUsers()

      expect(result).toEqual([])

      ;(config.auth as { currentUser: typeof originalUser }).currentUser = originalUser
    })

    it('isSearching が正しく切り替わる', async () => {
      mockGetDoc.mockResolvedValue(
        createMockDocumentSnapshot('current-uid', {
          uid: 'current-uid',
          workspaceId: 'WS-001',
          status: 'approved',
        }),
      )

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
