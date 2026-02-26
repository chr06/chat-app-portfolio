import { vi } from 'vitest'
import type { Timestamp } from 'firebase/firestore'
import type { User } from '@/types'

/**
 * Firebase Timestamp モック
 */
export function createMockTimestamp(date: Date = new Date()): Timestamp {
  return {
    toDate: () => date,
    toMillis: () => date.getTime(),
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
    isEqual: (other: { seconds: number }) =>
      Math.floor(date.getTime() / 1000) === other.seconds,
    toJSON: () => ({ seconds: Math.floor(date.getTime() / 1000), nanoseconds: 0, type: 'timestamp' }),
  } as unknown as Timestamp
}

/**
 * Firestore DocumentSnapshot モック
 */
export function createMockDocumentSnapshot(
  id: string,
  data: Record<string, unknown> | null,
) {
  return {
    id,
    exists: () => data !== null,
    data: () => data,
    ref: { id, path: `mock/${id}` },
    get: (field: string) => data?.[field],
  }
}

/**
 * Firestore QuerySnapshot モック
 */
export function createMockQuerySnapshot(
  docs: Array<{ id: string; data: Record<string, unknown> }>,
) {
  const mockDocs = docs.map((d) => createMockDocumentSnapshot(d.id, d.data))
  return {
    docs: mockDocs,
    size: docs.length,
    empty: docs.length === 0,
    forEach: (callback: (doc: ReturnType<typeof createMockDocumentSnapshot>) => void) =>
      mockDocs.forEach(callback),
  }
}

/**
 * Firebase Auth User モック
 */
export function createMockFirebaseUser(overrides: Partial<{
  uid: string
  email: string
  displayName: string
  photoURL: string
}> = {}) {
  return {
    uid: overrides.uid ?? 'test-uid-1',
    email: overrides.email ?? 'test1@example.com',
    displayName: overrides.displayName ?? 'テストユーザー1',
    photoURL: overrides.photoURL ?? 'https://example.com/photo.jpg',
    emailVerified: true,
    isAnonymous: false,
    metadata: {},
    providerData: [],
    refreshToken: '',
    tenantId: null,
    delete: vi.fn(),
    getIdToken: vi.fn().mockResolvedValue('mock-token'),
    getIdTokenResult: vi.fn(),
    reload: vi.fn(),
    toJSON: vi.fn(),
    providerId: 'google.com',
  }
}

/**
 * Firestore User プロフィール モック
 */
export function createMockUserProfile(overrides: Partial<User> = {}): User {
  const now = new Date()
  return {
    uid: overrides.uid ?? 'test-uid-1',
    displayName: overrides.displayName ?? 'テストユーザー1',
    photoURL: overrides.photoURL ?? 'https://example.com/photo.jpg',
    status: overrides.status ?? 'approved',
    createdAt: overrides.createdAt ?? createMockTimestamp(now),
    updatedAt: overrides.updatedAt ?? createMockTimestamp(now),
  } as User
}

/**
 * onSnapshot コールバックを手動で呼び出すためのヘルパー
 */
export function createMockOnSnapshot() {
  let callback: ((snapshot: unknown) => void) | null = null
  let errorCallback: ((error: Error) => void) | null = null
  const unsubscribe = vi.fn()

  const mock = vi.fn((...args: unknown[]) => {
    callback = args[1] as (snapshot: unknown) => void
    errorCallback = (args[2] as (error: Error) => void) || null
    return unsubscribe
  })

  return {
    mock,
    unsubscribe,
    triggerSnapshot: (snapshot: unknown) => callback?.(snapshot),
    triggerError: (error: Error) => errorCallback?.(error),
  }
}
