import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MessageItem from '../MessageItem.vue'
import { createMockTimestamp } from '@/__tests__/helpers/firebaseMocks'
import type { Message } from '@/types'

// EmojiPicker と Teleport をスタブ化
vi.mock('vue3-emoji-picker', () => ({
  default: {
    name: 'EmojiPicker',
    template: '<div class="emoji-picker-stub"></div>',
  },
}))
vi.mock('vue3-emoji-picker/css', () => ({}))

function createMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    senderId: 'sender-uid',
    text: '<p>Hello world</p>',
    reactions: {},
    createdAt: createMockTimestamp(new Date('2024-06-15T10:30:00')),
    ...overrides,
  } as Message
}

function mountMessageItem(props: Partial<{
  message: Message
  isOwn: boolean
  currentUserId: string
  senderName: string
  senderPhotoURL: string
}> = {}) {
  return mount(MessageItem, {
    props: {
      message: createMessage(),
      isOwn: false,
      currentUserId: 'current-uid',
      senderName: 'テストユーザー',
      senderPhotoURL: 'https://example.com/photo.jpg',
      ...props,
    },
    global: {
      stubs: {
        Teleport: true,
        EmojiPicker: true,
      },
    },
  })
}

describe('MessageItem', () => {
  describe('メッセージ表示', () => {
    it('テキストメッセージを表示する', () => {
      const wrapper = mountMessageItem({
        message: createMessage({ text: '<p>こんにちは</p>' }),
      })

      const content = wrapper.find('.message-content')
      expect(content.exists()).toBe(true)
      expect(content.html()).toContain('こんにちは')
    })

    it('HTML がサニタイズされる（script タグ除去）', () => {
      const wrapper = mountMessageItem({
        message: createMessage({
          text: '<p>Hello</p><script>alert("xss")</script>',
        }),
      })

      const content = wrapper.find('.message-content')
      expect(content.html()).toContain('Hello')
      expect(content.html()).not.toContain('script')
    })

    it('許可されたタグは維持される', () => {
      const wrapper = mountMessageItem({
        message: createMessage({
          text: '<p><strong>Bold</strong> and <em>italic</em></p>',
        }),
      })

      const content = wrapper.find('.message-content')
      expect(content.html()).toContain('<strong>')
      expect(content.html()).toContain('<em>')
    })

    it('テキストが空の場合、message-content を表示しない', () => {
      const wrapper = mountMessageItem({
        message: createMessage({ text: '' }),
      })

      expect(wrapper.find('.message-content').exists()).toBe(false)
    })
  })

  describe('自分のメッセージ vs 相手のメッセージ', () => {
    it('自分のメッセージは flex-row-reverse', () => {
      const wrapper = mountMessageItem({ isOwn: true })
      const container = wrapper.find('.flex.gap-3')
      expect(container.classes()).toContain('flex-row-reverse')
    })

    it('相手のメッセージは flex-row', () => {
      const wrapper = mountMessageItem({ isOwn: false })
      const container = wrapper.find('.flex.gap-3')
      expect(container.classes()).toContain('flex-row')
    })

    it('自分のメッセージにはアバターを表示しない', () => {
      const wrapper = mountMessageItem({ isOwn: true })
      // Avatar コンポーネントは v-if="!isOwn" で制御
      const avatars = wrapper.findAllComponents({ name: 'Avatar' })
      expect(avatars).toHaveLength(0)
    })

    it('相手のメッセージにはアバターを表示する', () => {
      const wrapper = mountMessageItem({ isOwn: false })
      const avatars = wrapper.findAllComponents({ name: 'Avatar' })
      expect(avatars).toHaveLength(1)
    })

    it('自分のメッセージは紫色の背景', () => {
      const wrapper = mountMessageItem({ isOwn: true })
      const bubble = wrapper.find('.bubble-own')
      expect(bubble.exists()).toBe(true)
    })

    it('相手のメッセージは灰色の背景', () => {
      const wrapper = mountMessageItem({ isOwn: false })
      const bubble = wrapper.find('.bubble-other')
      expect(bubble.exists()).toBe(true)
    })
  })

  describe('時刻表示', () => {
    it('HH:MM 形式で時刻を表示する', () => {
      const wrapper = mountMessageItem({
        message: createMessage({
          createdAt: createMockTimestamp(new Date('2024-06-15T10:30:00')),
        }),
      })

      const timeEl = wrapper.find('.text-xs.text-gray-400')
      expect(timeEl.exists()).toBe(true)
      expect(timeEl.text()).toMatch(/\d{2}:\d{2}/)
    })

    it('createdAt が null の場合、空文字を表示', () => {
      const wrapper = mountMessageItem({
        message: createMessage({ createdAt: null as unknown as Message['createdAt'] }),
      })

      const timeEl = wrapper.find('.text-xs.text-gray-400')
      expect(timeEl.text()).toBe('')
    })
  })

  describe('画像メッセージ', () => {
    it('imageUrl がある場合、画像を表示する', () => {
      const wrapper = mountMessageItem({
        message: createMessage({
          imageUrl: 'https://example.com/image.jpg',
        }),
      })

      const img = wrapper.find('img[alt="送信画像"]')
      expect(img.exists()).toBe(true)
      expect(img.attributes('src')).toBe('https://example.com/image.jpg')
    })

    it('imageUrl がない場合、画像を表示しない', () => {
      const wrapper = mountMessageItem({
        message: createMessage({ imageUrl: undefined }),
      })

      expect(wrapper.find('img[alt="送信画像"]').exists()).toBe(false)
    })
  })

  describe('リアクション', () => {
    it('リアクションがある場合、表示する', () => {
      const wrapper = mountMessageItem({
        message: createMessage({
          reactions: { '👍': ['user-1', 'user-2'], '❤️': ['user-1'] },
        }),
      })

      const reactionButtons = wrapper.findAll('button')
      // リアクション絵文字ボタン（emoji picker のボタンを除く）
      const emojiButtons = reactionButtons.filter((b) => b.text().includes('👍') || b.text().includes('❤️'))
      expect(emojiButtons).toHaveLength(2)
    })

    it('リアクション数を表示する', () => {
      const wrapper = mountMessageItem({
        message: createMessage({
          reactions: { '👍': ['user-1', 'user-2'] },
        }),
      })

      // 👍 のボタンに 2 が表示される
      const reactionButton = wrapper.findAll('button').find((b) => b.text().includes('👍'))
      expect(reactionButton?.text()).toContain('2')
    })

    it('空の uids 配列のリアクションは表示しない', () => {
      const wrapper = mountMessageItem({
        message: createMessage({
          reactions: { '👍': [] },
        }),
      })

      const reactionButton = wrapper.findAll('button').find((b) => b.text().includes('👍'))
      expect(reactionButton).toBeUndefined()
    })

    it('リアクションクリックで toggle イベントを emit する', async () => {
      const wrapper = mountMessageItem({
        message: createMessage({
          reactions: { '👍': ['other-uid'] },
        }),
        currentUserId: 'current-uid',
      })

      const reactionButton = wrapper.findAll('button').find((b) => b.text().includes('👍'))
      await reactionButton?.trigger('click')

      // currentUserId が 👍 に含まれていないので add-reaction が emit される
      expect(wrapper.emitted('add-reaction')).toBeTruthy()
      expect(wrapper.emitted('add-reaction')![0]).toEqual(['msg-1', '👍'])
    })

    it('自分がリアクション済みの場合、クリックで remove-reaction を emit する', async () => {
      const wrapper = mountMessageItem({
        message: createMessage({
          reactions: { '👍': ['current-uid'] },
        }),
        currentUserId: 'current-uid',
      })

      const reactionButton = wrapper.findAll('button').find((b) => b.text().includes('👍'))
      await reactionButton?.trigger('click')

      expect(wrapper.emitted('remove-reaction')).toBeTruthy()
      expect(wrapper.emitted('remove-reaction')![0]).toEqual(['msg-1', '👍'])
    })
  })
})
