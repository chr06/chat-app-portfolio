import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createMockFirebaseUser,
  createMockDocumentSnapshot,
  createMockOnSnapshot,
} from '@/__tests__/helpers/firebaseMocks'

// Firebase モジュールモック
const mockOnAuthStateChanged = vi.fn()
const mockSignInWithPopup = vi.fn()
const mockSignOut = vi.fn()
const mockGetDoc = vi.fn()
const mockSetDoc = vi.fn()
const { mock: mockOnSnapshot, triggerSnapshot } = createMockOnSnapshot()

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (...args: unknown[]) => mockOnAuthStateChanged(...(args as [])),
  signInWithPopup: (...args: unknown[]) => mockSignInWithPopup(...(args as [])),
  signOut: (...args: unknown[]) => mockSignOut(...(args as [])),
  GoogleAuthProvider: vi.fn(),
}))

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => 'mock-doc-ref'),
  getDoc: (...args: unknown[]) => mockGetDoc(...(args as [])),
  setDoc: (...args: unknown[]) => mockSetDoc(...(args as [])),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...(args as [])),
  serverTimestamp: vi.fn(() => 'mock-server-timestamp'),
}))

vi.mock('@/firebase/config', () => ({
  auth: { currentUser: null },
  db: {},
}))

vi.mock('@/config/testUsers', () => ({
  isTestUser: vi.fn((email: string) => email === 'test1@example.com'),
}))

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  async function loadUseAuth() {
    const mod = await import('../useAuth')
    return mod.useAuth()
  }

  it('初期状態が正しい', async () => {
    const auth = await loadUseAuth()

    expect(auth.user.value).toBeNull()
    expect(auth.userProfile.value).toBeNull()
    expect(auth.isLoading.value).toBe(true)
    expect(auth.error.value).toBeNull()
    expect(auth.isAuthenticated.value).toBe(false)
    expect(auth.isApproved.value).toBe(false)
    expect(auth.isPending.value).toBe(false)
  })

  it('init() で onAuthStateChanged を呼ぶ', async () => {
    const auth = await loadUseAuth()
    auth.init()

    expect(mockOnAuthStateChanged).toHaveBeenCalledOnce()
  })

  it('ユーザーがログインしている場合、プロフィールリスナーを設定する', async () => {
    const mockUser = createMockFirebaseUser()

    mockOnAuthStateChanged.mockImplementation((_authInstance: unknown, callback: Function) => {
      callback(mockUser)
      return vi.fn()
    })

    const auth = await loadUseAuth()
    auth.init()

    expect(mockOnSnapshot).toHaveBeenCalled()
  })

  it('プロフィールスナップショットが存在する場合、userProfile を更新する', async () => {
    const mockUser = createMockFirebaseUser()
    const profileData = {
      displayName: 'テストユーザー1',
      photoURL: 'https://example.com/photo.jpg',
      status: 'approved',
      isTestUser: true,
    }

    mockOnAuthStateChanged.mockImplementation((_authInstance: unknown, callback: Function) => {
      callback(mockUser)
      return vi.fn()
    })

    const auth = await loadUseAuth()
    auth.init()

    // onSnapshot のコールバックを実行
    triggerSnapshot(createMockDocumentSnapshot('test-uid-1', profileData))

    expect(auth.userProfile.value).toEqual({
      uid: 'test-uid-1',
      ...profileData,
    })
    expect(auth.isLoading.value).toBe(false)
    expect(auth.isApproved.value).toBe(true)
  })

  it('プロフィールが存在しない場合、userProfile は null', async () => {
    const mockUser = createMockFirebaseUser()

    mockOnAuthStateChanged.mockImplementation((_authInstance: unknown, callback: Function) => {
      callback(mockUser)
      return vi.fn()
    })

    const auth = await loadUseAuth()
    auth.init()

    triggerSnapshot(createMockDocumentSnapshot('test-uid-1', null))

    expect(auth.userProfile.value).toBeNull()
    expect(auth.isLoading.value).toBe(false)
  })

  it('ユーザーがログアウトした場合、状態をリセットする', async () => {
    mockOnAuthStateChanged.mockImplementation((_authInstance: unknown, callback: Function) => {
      callback(null)
      return vi.fn()
    })

    const auth = await loadUseAuth()
    auth.init()

    expect(auth.user.value).toBeNull()
    expect(auth.userProfile.value).toBeNull()
    expect(auth.isLoading.value).toBe(false)
  })

  it('signInWithGoogle が新規ユーザードキュメントを作成する', async () => {
    const mockUser = createMockFirebaseUser({ email: 'test1@example.com' })
    mockSignInWithPopup.mockResolvedValue({ user: mockUser })
    mockGetDoc.mockResolvedValue(createMockDocumentSnapshot('test-uid-1', null))
    mockSetDoc.mockResolvedValue(undefined)

    const auth = await loadUseAuth()
    await auth.signInWithGoogle()

    expect(mockSignInWithPopup).toHaveBeenCalledOnce()
    expect(mockSetDoc).toHaveBeenCalledOnce()

    // テストユーザーは auto-approved
    const setDocCall = mockSetDoc.mock.calls[0]!
    expect(setDocCall[1]).toMatchObject({
      uid: 'test-uid-1',
      status: 'approved',
      isTestUser: true,
    })
  })

  it('signInWithGoogle が既存テストユーザーを承認する', async () => {
    const mockUser = createMockFirebaseUser({ email: 'test1@example.com' })
    mockSignInWithPopup.mockResolvedValue({ user: mockUser })
    mockGetDoc.mockResolvedValue(
      createMockDocumentSnapshot('test-uid-1', { status: 'pending' }),
    )
    mockSetDoc.mockResolvedValue(undefined)

    const auth = await loadUseAuth()
    await auth.signInWithGoogle()

    // merge: true で承認状態に更新
    const setDocCall = mockSetDoc.mock.calls[0]!
    expect(setDocCall[1]).toMatchObject({
      status: 'approved',
      isTestUser: true,
    })
    expect(setDocCall[2]).toEqual({ merge: true })
  })

  it('signInWithGoogle がエラーを投げた場合、error を設定する', async () => {
    const mockError = new Error('Auth error')
    mockSignInWithPopup.mockRejectedValue(mockError)

    const auth = await loadUseAuth()

    await expect(auth.signInWithGoogle()).rejects.toThrow('Auth error')
    expect(auth.error.value).toBe(mockError)
  })

  it('signOut が firebaseSignOut を呼ぶ', async () => {
    mockSignOut.mockResolvedValue(undefined)

    const auth = await loadUseAuth()
    await auth.signOut()

    expect(mockSignOut).toHaveBeenCalledOnce()
  })

  it('computed isApproved / isPending が正しく動作する', async () => {
    const mockUser = createMockFirebaseUser()

    mockOnAuthStateChanged.mockImplementation((_authInstance: unknown, callback: Function) => {
      callback(mockUser)
      return vi.fn()
    })

    const auth = await loadUseAuth()
    auth.init()

    // pending 状態
    triggerSnapshot(
      createMockDocumentSnapshot('test-uid-1', { status: 'pending' }),
    )
    expect(auth.isPending.value).toBe(true)
    expect(auth.isApproved.value).toBe(false)

    // approved 状態
    triggerSnapshot(
      createMockDocumentSnapshot('test-uid-1', { status: 'approved' }),
    )
    expect(auth.isPending.value).toBe(false)
    expect(auth.isApproved.value).toBe(true)
  })

  it('cleanup がリスナーを解除する', async () => {
    const unsubAuth = vi.fn()
    mockOnAuthStateChanged.mockReturnValue(unsubAuth)

    const auth = await loadUseAuth()
    auth.init()
    auth.cleanup()

    expect(unsubAuth).toHaveBeenCalled()
  })
})
