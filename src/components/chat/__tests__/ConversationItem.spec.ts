import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ConversationItem from '../ConversationItem.vue'
import { createMockTimestamp } from '@/__tests__/helpers/firebaseMocks'
import type { Conversation } from '@/types'

function createConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'conv-1',
    participants: ['current-uid', 'other-uid'],
    participantDetails: {
      'current-uid': { displayName: '自分', photoURL: '' },
      'other-uid': {
        displayName: 'テストユーザー',
        photoURL: 'https://example.com/photo.jpg',
      },
    },
    lastMessage: {
      text: 'こんにちは',
      senderId: 'other-uid',
      createdAt: createMockTimestamp(new Date('2024-06-15T10:30:00')),
    },
    createdAt: createMockTimestamp(new Date('2024-06-15T10:00:00')),
    updatedAt: createMockTimestamp(new Date('2024-06-15T10:30:00')),
    ...overrides,
  } as Conversation
}

function mountConversationItem(props: Partial<{
  conversation: Conversation
  currentUserId: string
  isSelected: boolean
}> = {}) {
  return mount(ConversationItem, {
    props: {
      conversation: createConversation(),
      currentUserId: 'current-uid',
      isSelected: false,
      ...props,
    },
  })
}

describe('ConversationItem', () => {
  describe('参加者表示', () => {
    it('相手の名前を表示する', () => {
      const wrapper = mountConversationItem()
      expect(wrapper.text()).toContain('テストユーザー')
    })

    it('participantDetails に相手がいない場合、"不明なユーザー" を表示する', () => {
      const wrapper = mountConversationItem({
        conversation: createConversation({
          participantDetails: {
            'current-uid': { displayName: '自分', photoURL: '' },
          },
        }),
      })
      expect(wrapper.text()).toContain('不明なユーザー')
    })

    it('Avatar コンポーネントに相手の情報を渡す', () => {
      const wrapper = mountConversationItem()
      const avatar = wrapper.findComponent({ name: 'Avatar' })
      expect(avatar.exists()).toBe(true)
      expect(avatar.props('src')).toBe('https://example.com/photo.jpg')
      expect(avatar.props('name')).toBe('テストユーザー')
    })
  })

  describe('最終メッセージプレビュー', () => {
    it('相手のメッセージをそのまま表示する', () => {
      const wrapper = mountConversationItem({
        conversation: createConversation({
          lastMessage: {
            text: 'こんにちは',
            senderId: 'other-uid',
            createdAt: createMockTimestamp(),
          },
        }),
      })
      expect(wrapper.text()).toContain('こんにちは')
      expect(wrapper.text()).not.toContain('あなた:')
    })

    it('自分のメッセージには "あなた: " プレフィックスを付ける', () => {
      const wrapper = mountConversationItem({
        conversation: createConversation({
          lastMessage: {
            text: 'メッセージです',
            senderId: 'current-uid',
            createdAt: createMockTimestamp(),
          },
        }),
      })
      expect(wrapper.text()).toContain('あなた:')
      expect(wrapper.text()).toContain('メッセージです')
    })

    it('30文字を超えるメッセージは省略される', () => {
      const longText = 'あ'.repeat(35)
      const wrapper = mountConversationItem({
        conversation: createConversation({
          lastMessage: {
            text: longText,
            senderId: 'other-uid',
            createdAt: createMockTimestamp(),
          },
        }),
      })
      expect(wrapper.text()).toContain('...')
    })

    it('30文字以下のメッセージは省略されない', () => {
      const shortText = 'あ'.repeat(20)
      const wrapper = mountConversationItem({
        conversation: createConversation({
          lastMessage: {
            text: shortText,
            senderId: 'other-uid',
            createdAt: createMockTimestamp(),
          },
        }),
      })
      expect(wrapper.text()).not.toContain('...')
    })

    it('lastMessage が null の場合、"メッセージがありません" を表示する', () => {
      const wrapper = mountConversationItem({
        conversation: createConversation({ lastMessage: null }),
      })
      expect(wrapper.text()).toContain('メッセージがありません')
    })

    it('lastMessage.text が空の場合、"画像を送信しました" を表示する', () => {
      const wrapper = mountConversationItem({
        conversation: createConversation({
          lastMessage: {
            text: '',
            senderId: 'other-uid',
            createdAt: createMockTimestamp(),
          },
        }),
      })
      expect(wrapper.text()).toContain('画像を送信しました')
    })
  })

  describe('時刻フォーマット', () => {
    it('今日の場合、HH:MM を表示する', () => {
      const now = new Date()
      now.setHours(14, 30, 0, 0)

      const wrapper = mountConversationItem({
        conversation: createConversation({
          updatedAt: createMockTimestamp(now),
        }),
      })

      expect(wrapper.text()).toMatch(/\d{2}:\d{2}/)
    })

    it('昨日の場合、"昨日" を表示する', () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      yesterday.setHours(12, 0, 0, 0)

      const wrapper = mountConversationItem({
        conversation: createConversation({
          updatedAt: createMockTimestamp(yesterday),
        }),
      })

      expect(wrapper.text()).toContain('昨日')
    })

    it('今週（2〜6日前）の場合、曜日を表示する', () => {
      const threeDaysAgo = new Date()
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
      threeDaysAgo.setHours(12, 0, 0, 0)

      const wrapper = mountConversationItem({
        conversation: createConversation({
          updatedAt: createMockTimestamp(threeDaysAgo),
        }),
      })

      const dayNames = ['日', '月', '火', '水', '木', '金', '土']
      const expectedDay = dayNames[threeDaysAgo.getDay()]
      expect(wrapper.text()).toContain(expectedDay)
    })

    it('1週間以上前の場合、月日を表示する', () => {
      const twoWeeksAgo = new Date()
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
      twoWeeksAgo.setHours(12, 0, 0, 0)

      const wrapper = mountConversationItem({
        conversation: createConversation({
          updatedAt: createMockTimestamp(twoWeeksAgo),
        }),
      })

      // 月日のフォーマット（例: "6月1日"）
      const text = wrapper.text()
      expect(text).toMatch(/\d{1,2}月\d{1,2}日/)
    })
  })

  describe('選択状態', () => {
    it('isSelected が true の場合、選択スタイルが適用される', () => {
      const wrapper = mountConversationItem({ isSelected: true })
      const container = wrapper.find('.flex.items-center')
      expect(container.classes().some((c) => c.includes('bg-slack-purple'))).toBe(true)
    })

    it('isSelected が false の場合、hover スタイルが適用される', () => {
      const wrapper = mountConversationItem({ isSelected: false })
      const container = wrapper.find('.flex.items-center')
      expect(container.classes().some((c) => c.includes('hover:bg-white/10'))).toBe(true)
    })
  })
})
