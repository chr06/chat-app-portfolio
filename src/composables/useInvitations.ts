import { ref, readonly } from 'vue'
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore'
import { db, auth } from '@/firebase/config'
import type { Invitation } from '@/types'

// NOTE: 読み間違いやすい文字（O/0/I/1/l）を除外した文字セット
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 8

/**
 * 招待コードを生成（8文字の英数字）
 */
function generateInvitationCode(): string {
  const array = new Uint8Array(CODE_LENGTH)
  crypto.getRandomValues(array)
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS[array[i]! % CODE_CHARS.length]
  }
  return code
}

export function useInvitations() {
  const isCreating = ref(false)
  const isAccepting = ref(false)
  const isLoading = ref(false)
  const error = ref<Error | null>(null)
  const myInvitations = ref<Invitation[]>([])

  /**
   * 新しい招待コードを作成
   */
  async function createInvitation(): Promise<string | null> {
    const currentUser = auth.currentUser
    if (!currentUser) return null

    isCreating.value = true
    error.value = null

    try {
      let code: string = ''
      let attempts = 0
      do {
        code = generateInvitationCode()
        const existing = await getDoc(doc(db, 'invitations', code))
        if (!existing.exists()) break
        attempts++
      } while (attempts < 3)

      if (attempts >= 3) {
        throw new Error('招待コードの生成に失敗しました。もう一度お試しください。')
      }

      await setDoc(doc(db, 'invitations', code), {
        code,
        inviterUid: currentUser.uid,
        inviteeUid: null,
        status: 'pending',
        createdAt: serverTimestamp(),
        acceptedAt: null,
      })

      return code
    } catch (e) {
      error.value = e as Error
      console.error('招待コード作成エラー:', e)
      return null
    } finally {
      isCreating.value = false
    }
  }

  /**
   * 招待コードを検証して取得
   */
  async function getInvitation(code: string): Promise<Invitation | null> {
    try {
      const snapshot = await getDoc(doc(db, 'invitations', code.toUpperCase()))
      if (!snapshot.exists()) return null
      return snapshot.data() as Invitation
    } catch (e) {
      console.error('招待コード取得エラー:', e)
      return null
    }
  }

  /**
   * 招待を受け入れる
   */
  async function acceptInvitation(code: string): Promise<boolean> {
    const currentUser = auth.currentUser
    if (!currentUser) return false

    isAccepting.value = true
    error.value = null

    try {
      const upperCode = code.toUpperCase()
      const invitationRef = doc(db, 'invitations', upperCode)
      const snapshot = await getDoc(invitationRef)

      if (!snapshot.exists()) {
        error.value = new Error('招待コードが見つかりません')
        return false
      }

      const invitation = snapshot.data() as Invitation

      if (invitation.status !== 'pending') {
        error.value = new Error('この招待コードは既に使用されています')
        return false
      }

      if (invitation.inviterUid === currentUser.uid) {
        error.value = new Error('自分の招待コードは使用できません')
        return false
      }

      // NOTE: 招待者のワークスペースIDを取得
      const inviterRef = doc(db, 'users', invitation.inviterUid)
      const inviterSnapshot = await getDoc(inviterRef)
      if (!inviterSnapshot.exists()) {
        error.value = new Error('招待元ユーザーが見つかりません')
        return false
      }
      const inviterWorkspaceId = inviterSnapshot.data().workspaceId as string | undefined

      // NOTE: 招待を受諾
      await updateDoc(invitationRef, {
        inviteeUid: currentUser.uid,
        status: 'accepted',
        acceptedAt: serverTimestamp(),
      })

      // NOTE: 自分のユーザードキュメントに invitedBy・workspaceId を設定し、自動承認する （ドキュメントが存在しない場合は新規作成する）
      const userRef = doc(db, 'users', currentUser.uid)
      const userSnapshot = await getDoc(userRef)

      if (userSnapshot.exists()) {
        await updateDoc(userRef, {
          invitedBy: invitation.inviterUid,
          status: 'approved',
          ...(inviterWorkspaceId ? { workspaceId: inviterWorkspaceId } : {}),
          updatedAt: serverTimestamp(),
        })
      } else {
        await setDoc(userRef, {
          uid: currentUser.uid,
          displayName: currentUser.displayName || 'ユーザー',
          photoURL: currentUser.photoURL || '',
          invitedBy: invitation.inviterUid,
          status: 'approved',
          ...(inviterWorkspaceId ? { workspaceId: inviterWorkspaceId } : {}),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      }

      return true
    } catch (e) {
      error.value = e as Error
      console.error('招待受諾エラー:', e)
      return false
    } finally {
      isAccepting.value = false
    }
  }

  /**
   * 自分が作成した招待一覧を取得
   */
  async function getMyInvitations(): Promise<Invitation[]> {
    const currentUser = auth.currentUser
    if (!currentUser) return []

    isLoading.value = true

    try {
      const q = query(collection(db, 'invitations'), where('inviterUid', '==', currentUser.uid))
      const snapshot = await getDocs(q)
      const invitations = snapshot.docs.map((d) => d.data() as Invitation)
      myInvitations.value = invitations
      return invitations
    } catch (e) {
      error.value = e as Error
      console.error('招待一覧取得エラー:', e)
      return []
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 招待リンクURLを生成
   */
  function generateInvitationUrl(code: string): string {
    return `${window.location.origin}/login?invite=${code}`
  }

  /**
   * 自分と接続されているユーザーのUID一覧を取得
   */
  async function getConnectedUserIds(): Promise<string[]> {
    const currentUser = auth.currentUser
    if (!currentUser) return []

    try {
      // NOTE: 自分が招待した人
      const sentQuery = query(
        collection(db, 'invitations'),
        where('inviterUid', '==', currentUser.uid),
        where('status', '==', 'accepted'),
      )
      const sentSnapshot = await getDocs(sentQuery)
      const invitedUids = sentSnapshot.docs
        .map((d) => d.data().inviteeUid as string)
        .filter(Boolean)

      // NOTE: 自分を招待した人
      const receivedQuery = query(
        collection(db, 'invitations'),
        where('inviteeUid', '==', currentUser.uid),
        where('status', '==', 'accepted'),
      )
      const receivedSnapshot = await getDocs(receivedQuery)
      const inviterUids = receivedSnapshot.docs.map((d) => d.data().inviterUid as string)

      return [...new Set([...invitedUids, ...inviterUids])]
    } catch (e) {
      console.error('接続ユーザー取得エラー:', e)
      return []
    }
  }

  return {
    isCreating: readonly(isCreating),
    isAccepting: readonly(isAccepting),
    isLoading: readonly(isLoading),
    error: readonly(error),
    myInvitations: readonly(myInvitations),
    createInvitation,
    getInvitation,
    acceptInvitation,
    getMyInvitations,
    generateInvitationUrl,
    getConnectedUserIds,
  }
}
