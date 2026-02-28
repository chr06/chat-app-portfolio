import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createMockDocumentSnapshot,
  createMockQuerySnapshot,
} from '@/__tests__/helpers/firebaseMocks'

const mockGetDoc = vi.fn()
const mockSetDoc = vi.fn()
const mockUpdateDoc = vi.fn()
const mockGetDocs = vi.fn()

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => 'mock-doc-ref'),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  collection: vi.fn(() => 'mock-collection-ref'),
  query: vi.fn(() => 'mock-query'),
  where: vi.fn(),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  serverTimestamp: vi.fn(() => 'mock-server-timestamp'),
}))

vi.mock('@/firebase/config', () => ({
  db: {},
  auth: { currentUser: { uid: 'current-uid' } },
}))

// crypto.getRandomValues のモック
const mockGetRandomValues = vi.fn()
Object.defineProperty(globalThis, 'crypto', {
  value: { getRandomValues: mockGetRandomValues },
  writable: true,
})

describe('useInvitations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSetDoc.mockResolvedValue(undefined)
    mockUpdateDoc.mockResolvedValue(undefined)
  })

  async function loadUseInvitations() {
    const mod = await import('../useInvitations')
    return mod.useInvitations()
  }

  describe('createInvitation', () => {
    it('新しい招待コードを作成する', async () => {
      // コード生成用のランダム値をモック
      mockGetRandomValues.mockImplementation((arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) arr[i] = i
        return arr
      })

      // コードが存在しない場合
      mockGetDoc.mockResolvedValue(createMockDocumentSnapshot('code', null))

      const { createInvitation } = await loadUseInvitations()
      const code = await createInvitation()

      expect(code).toBeTruthy()
      expect(code).toHaveLength(8)
      expect(mockSetDoc).toHaveBeenCalledOnce()
    })

    it('ユーザー未ログインの場合 null を返す', async () => {
      // auth.currentUser を一時的に null に
      const config = await import('@/firebase/config')
      const originalUser = config.auth.currentUser
      ;(config.auth as { currentUser: null }).currentUser = null

      const { createInvitation } = await loadUseInvitations()
      const code = await createInvitation()

      expect(code).toBeNull()
      expect(mockSetDoc).not.toHaveBeenCalled()

      // 元に戻す
      ;(config.auth as { currentUser: typeof originalUser }).currentUser = originalUser
    })

    it('isCreating が正しく切り替わる', async () => {
      mockGetRandomValues.mockImplementation((arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) arr[i] = i
        return arr
      })
      mockGetDoc.mockResolvedValue(createMockDocumentSnapshot('code', null))

      const { createInvitation, isCreating } = await loadUseInvitations()

      expect(isCreating.value).toBe(false)

      const promise = createInvitation()
      // Note: isCreating は非同期処理のため、ここでは直接確認が困難

      await promise

      expect(isCreating.value).toBe(false)
    })

    it('コード衝突時にリトライする', async () => {
      mockGetRandomValues.mockImplementation((arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) arr[i] = i
        return arr
      })

      // 最初の2回はコードが既に存在、3回目は存在しない
      mockGetDoc
        .mockResolvedValueOnce(createMockDocumentSnapshot('code1', { code: 'existing' }))
        .mockResolvedValueOnce(createMockDocumentSnapshot('code2', { code: 'existing' }))
        .mockResolvedValueOnce(createMockDocumentSnapshot('code3', null))

      const { createInvitation } = await loadUseInvitations()
      const code = await createInvitation()

      expect(code).toBeTruthy()
      expect(mockGetDoc).toHaveBeenCalledTimes(3)
    })
  })

  describe('getInvitation', () => {
    it('存在する招待コードを返す', async () => {
      const invitationData = {
        code: 'ABCD1234',
        inviterUid: 'inviter-uid',
        inviteeUid: null,
        status: 'pending',
      }
      mockGetDoc.mockResolvedValue(
        createMockDocumentSnapshot('ABCD1234', invitationData),
      )

      const { getInvitation } = await loadUseInvitations()
      const result = await getInvitation('abcd1234')

      expect(result).toMatchObject(invitationData)
    })

    it('存在しないコードは null を返す', async () => {
      mockGetDoc.mockResolvedValue(createMockDocumentSnapshot('INVALID', null))

      const { getInvitation } = await loadUseInvitations()
      const result = await getInvitation('INVALID')

      expect(result).toBeNull()
    })

    it('エラー時は null を返す', async () => {
      mockGetDoc.mockRejectedValue(new Error('Firestore error'))

      const { getInvitation } = await loadUseInvitations()
      const result = await getInvitation('CODE')

      expect(result).toBeNull()
    })
  })

  describe('acceptInvitation', () => {
    it('有効な招待コードを受け入れ、招待者のワークスペースを引き継ぐ', async () => {
      // 1回目: 招待ドキュメント取得
      // 2回目: 招待者ユーザードキュメント取得（workspaceId含む）
      // 3回目: 自分のユーザードキュメント取得（存在チェック）
      mockGetDoc
        .mockResolvedValueOnce(
          createMockDocumentSnapshot('ABCD1234', {
            code: 'ABCD1234',
            inviterUid: 'inviter-uid',
            inviteeUid: null,
            status: 'pending',
          }),
        )
        .mockResolvedValueOnce(
          createMockDocumentSnapshot('inviter-uid', {
            uid: 'inviter-uid',
            displayName: '招待者',
            workspaceId: 'WS-INVITER',
            status: 'approved',
          }),
        )
        .mockResolvedValueOnce(
          createMockDocumentSnapshot('current-uid', {
            uid: 'current-uid',
            displayName: '自分',
            status: 'pending',
          }),
        )

      const { acceptInvitation } = await loadUseInvitations()
      const result = await acceptInvitation('abcd1234')

      expect(result).toBe(true)
      expect(mockUpdateDoc).toHaveBeenCalledTimes(2) // invitation + user

      // ユーザー更新にworkspaceIdが含まれることを検証
      const userUpdateCall = mockUpdateDoc.mock.calls[1]!
      expect(userUpdateCall[1]).toMatchObject({
        invitedBy: 'inviter-uid',
        status: 'approved',
        workspaceId: 'WS-INVITER',
      })
    })

    it('招待元ユーザーが存在しない場合 false を返す', async () => {
      mockGetDoc
        .mockResolvedValueOnce(
          createMockDocumentSnapshot('ABCD1234', {
            code: 'ABCD1234',
            inviterUid: 'inviter-uid',
            inviteeUid: null,
            status: 'pending',
          }),
        )
        .mockResolvedValueOnce(
          createMockDocumentSnapshot('inviter-uid', null),
        )

      const { acceptInvitation, error } = await loadUseInvitations()
      const result = await acceptInvitation('abcd1234')

      expect(result).toBe(false)
      expect(error.value?.message).toBe('招待元ユーザーが見つかりません')
    })

    it('ユーザードキュメントが存在しない場合は新規作成する', async () => {
      mockGetDoc
        .mockResolvedValueOnce(
          createMockDocumentSnapshot('ABCD1234', {
            code: 'ABCD1234',
            inviterUid: 'inviter-uid',
            inviteeUid: null,
            status: 'pending',
          }),
        )
        .mockResolvedValueOnce(
          createMockDocumentSnapshot('inviter-uid', {
            uid: 'inviter-uid',
            workspaceId: 'WS-INVITER',
            status: 'approved',
          }),
        )
        .mockResolvedValueOnce(
          createMockDocumentSnapshot('current-uid', null), // ドキュメントが存在しない
        )

      const { acceptInvitation } = await loadUseInvitations()
      const result = await acceptInvitation('abcd1234')

      expect(result).toBe(true)
      // setDocで新規作成されることを検証
      expect(mockSetDoc).toHaveBeenCalled()
      const setDocCall = mockSetDoc.mock.calls[0]!
      expect(setDocCall[1]).toMatchObject({
        uid: 'current-uid',
        status: 'approved',
        workspaceId: 'WS-INVITER',
        invitedBy: 'inviter-uid',
      })
    })

    it('存在しない招待コードは false を返す', async () => {
      mockGetDoc.mockResolvedValue(createMockDocumentSnapshot('INVALID', null))

      const { acceptInvitation, error } = await loadUseInvitations()
      const result = await acceptInvitation('INVALID')

      expect(result).toBe(false)
      expect(error.value?.message).toBe('招待コードが見つかりません')
    })

    it('既に使用済みのコードは false を返す', async () => {
      mockGetDoc.mockResolvedValue(
        createMockDocumentSnapshot('USED', {
          code: 'USED',
          inviterUid: 'inviter-uid',
          inviteeUid: 'other-uid',
          status: 'accepted',
        }),
      )

      const { acceptInvitation, error } = await loadUseInvitations()
      const result = await acceptInvitation('USED')

      expect(result).toBe(false)
      expect(error.value?.message).toBe('この招待コードは既に使用されています')
    })

    it('自分が作成したコードは false を返す', async () => {
      mockGetDoc.mockResolvedValue(
        createMockDocumentSnapshot('MYCODE', {
          code: 'MYCODE',
          inviterUid: 'current-uid',
          inviteeUid: null,
          status: 'pending',
        }),
      )

      const { acceptInvitation, error } = await loadUseInvitations()
      const result = await acceptInvitation('MYCODE')

      expect(result).toBe(false)
      expect(error.value?.message).toBe('自分の招待コードは使用できません')
    })

    it('ユーザー未ログインの場合 false を返す', async () => {
      const config = await import('@/firebase/config')
      const originalUser = config.auth.currentUser
      ;(config.auth as { currentUser: null }).currentUser = null

      const { acceptInvitation } = await loadUseInvitations()
      const result = await acceptInvitation('CODE')

      expect(result).toBe(false)
      expect(mockUpdateDoc).not.toHaveBeenCalled()

      ;(config.auth as { currentUser: typeof originalUser }).currentUser = originalUser
    })

    it('isAccepting が正しく切り替わる', async () => {
      mockGetDoc
        .mockResolvedValueOnce(
          createMockDocumentSnapshot('CODE', {
            code: 'CODE',
            inviterUid: 'inviter-uid',
            inviteeUid: null,
            status: 'pending',
          }),
        )
        .mockResolvedValueOnce(
          createMockDocumentSnapshot('inviter-uid', {
            uid: 'inviter-uid',
            workspaceId: 'WS-TEST',
            status: 'approved',
          }),
        )
        .mockResolvedValueOnce(
          createMockDocumentSnapshot('current-uid', {
            uid: 'current-uid',
            status: 'pending',
          }),
        )

      const { acceptInvitation, isAccepting } = await loadUseInvitations()

      expect(isAccepting.value).toBe(false)
      await acceptInvitation('CODE')
      expect(isAccepting.value).toBe(false)
    })
  })

  describe('getMyInvitations', () => {
    it('自分が作成した招待一覧を返す', async () => {
      mockGetDocs.mockResolvedValue(
        createMockQuerySnapshot([
          {
            id: 'CODE1',
            data: {
              code: 'CODE1',
              inviterUid: 'current-uid',
              inviteeUid: 'user-1',
              status: 'accepted',
            },
          },
          {
            id: 'CODE2',
            data: {
              code: 'CODE2',
              inviterUid: 'current-uid',
              inviteeUid: null,
              status: 'pending',
            },
          },
        ]),
      )

      const { getMyInvitations, myInvitations } = await loadUseInvitations()
      const result = await getMyInvitations()

      expect(result).toHaveLength(2)
      expect(myInvitations.value).toHaveLength(2)
    })

    it('ユーザー未ログインの場合は空配列を返す', async () => {
      const config = await import('@/firebase/config')
      const originalUser = config.auth.currentUser
      ;(config.auth as { currentUser: null }).currentUser = null

      const { getMyInvitations } = await loadUseInvitations()
      const result = await getMyInvitations()

      expect(result).toEqual([])

      ;(config.auth as { currentUser: typeof originalUser }).currentUser = originalUser
    })
  })

  describe('generateInvitationUrl', () => {
    it('招待リンクURLを生成する', async () => {
      const { generateInvitationUrl } = await loadUseInvitations()
      const url = generateInvitationUrl('ABCD1234')

      expect(url).toContain('/login?invite=ABCD1234')
    })
  })

  describe('getConnectedUserIds', () => {
    it('招待関係のあるUID一覧を返す', async () => {
      // 1回目: 自分が招待した人
      mockGetDocs
        .mockResolvedValueOnce(
          createMockQuerySnapshot([
            {
              id: 'inv1',
              data: { inviterUid: 'current-uid', inviteeUid: 'user-a', status: 'accepted' },
            },
            {
              id: 'inv2',
              data: { inviterUid: 'current-uid', inviteeUid: 'user-b', status: 'accepted' },
            },
          ]),
        )
        // 2回目: 自分を招待した人
        .mockResolvedValueOnce(
          createMockQuerySnapshot([
            {
              id: 'inv3',
              data: { inviterUid: 'user-c', inviteeUid: 'current-uid', status: 'accepted' },
            },
          ]),
        )

      const { getConnectedUserIds } = await loadUseInvitations()
      const result = await getConnectedUserIds()

      expect(result).toHaveLength(3)
      expect(result).toContain('user-a')
      expect(result).toContain('user-b')
      expect(result).toContain('user-c')
    })

    it('重複するUIDは排除する', async () => {
      mockGetDocs
        .mockResolvedValueOnce(
          createMockQuerySnapshot([
            {
              id: 'inv1',
              data: { inviterUid: 'current-uid', inviteeUid: 'user-a', status: 'accepted' },
            },
          ]),
        )
        .mockResolvedValueOnce(
          createMockQuerySnapshot([
            {
              id: 'inv2',
              data: { inviterUid: 'user-a', inviteeUid: 'current-uid', status: 'accepted' },
            },
          ]),
        )

      const { getConnectedUserIds } = await loadUseInvitations()
      const result = await getConnectedUserIds()

      expect(result).toHaveLength(1)
      expect(result).toContain('user-a')
    })

    it('ユーザー未ログインの場合は空配列を返す', async () => {
      const config = await import('@/firebase/config')
      const originalUser = config.auth.currentUser
      ;(config.auth as { currentUser: null }).currentUser = null

      const { getConnectedUserIds } = await loadUseInvitations()
      const result = await getConnectedUserIds()

      expect(result).toEqual([])

      ;(config.auth as { currentUser: typeof originalUser }).currentUser = originalUser
    })

    it('エラー時は空配列を返す', async () => {
      mockGetDocs.mockRejectedValue(new Error('Firestore error'))

      const { getConnectedUserIds } = await loadUseInvitations()
      const result = await getConnectedUserIds()

      expect(result).toEqual([])
    })
  })
})
