import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Avatar from '../Avatar.vue'

describe('Avatar', () => {
  describe('画像表示', () => {
    it('src が指定されている場合、img タグを表示する', () => {
      const wrapper = mount(Avatar, {
        props: {
          src: 'https://example.com/photo.jpg',
          name: 'テストユーザー',
        },
      })

      const img = wrapper.find('img')
      expect(img.exists()).toBe(true)
      expect(img.attributes('src')).toBe('https://example.com/photo.jpg')
      expect(img.attributes('alt')).toBe('テストユーザー')
    })

    it('src が null の場合、イニシャルを表示する', () => {
      const wrapper = mount(Avatar, {
        props: {
          src: null,
          name: 'テストユーザー',
        },
      })

      expect(wrapper.find('img').exists()).toBe(false)
      const initialsDiv = wrapper.find('.rounded-full.flex')
      expect(initialsDiv.exists()).toBe(true)
      expect(initialsDiv.text()).toBe('テ')
    })
  })

  describe('イニシャル生成', () => {
    it('1文字の名前の場合、先頭文字を表示する', () => {
      const wrapper = mount(Avatar, { props: { name: 'A' } })
      expect(wrapper.find('.rounded-full.flex').text()).toBe('A')
    })

    it('複数単語の場合、各単語の先頭を連結する', () => {
      const wrapper = mount(Avatar, { props: { name: 'John Doe' } })
      expect(wrapper.find('.rounded-full.flex').text()).toBe('JD')
    })

    it('3単語以上は2文字まで', () => {
      const wrapper = mount(Avatar, { props: { name: 'John Michael Doe' } })
      expect(wrapper.find('.rounded-full.flex').text()).toBe('JM')
    })

    it('名前が空の場合は ? を表示する', () => {
      const wrapper = mount(Avatar, { props: { name: '' } })
      expect(wrapper.find('.rounded-full.flex').text()).toBe('?')
    })

    it('名前未指定の場合は ? を表示する', () => {
      const wrapper = mount(Avatar)
      expect(wrapper.find('.rounded-full.flex').text()).toBe('?')
    })
  })

  describe('サイズ', () => {
    const sizeTests = [
      { size: 'xs' as const, expected: 'w-6 h-6' },
      { size: 'sm' as const, expected: 'w-8 h-8' },
      { size: 'md' as const, expected: 'w-10 h-10' },
      { size: 'lg' as const, expected: 'w-12 h-12' },
      { size: 'xl' as const, expected: 'w-16 h-16' },
    ]

    sizeTests.forEach(({ size, expected }) => {
      it(`size="${size}" の場合、${expected} クラスを適用する`, () => {
        const wrapper = mount(Avatar, { props: { name: 'Test', size } })
        const el = wrapper.find('.rounded-full')
        expected.split(' ').forEach((cls) => {
          expect(el.classes()).toContain(cls)
        })
      })
    })

    it('デフォルトサイズは md', () => {
      const wrapper = mount(Avatar, { props: { name: 'Test' } })
      const el = wrapper.find('.rounded-full')
      expect(el.classes()).toContain('w-10')
      expect(el.classes()).toContain('h-10')
    })
  })

  describe('背景色（イニシャル表示時）', () => {
    it('同じ名前は常に同じ色を返す', () => {
      const wrapper1 = mount(Avatar, { props: { name: 'Alice' } })
      const wrapper2 = mount(Avatar, { props: { name: 'Alice' } })

      const classes1 = wrapper1.find('.rounded-full.flex').classes()
      const classes2 = wrapper2.find('.rounded-full.flex').classes()

      // bg-XXX-500 クラスを比較
      const bgClass1 = classes1.find((c) => c.startsWith('bg-'))
      const bgClass2 = classes2.find((c) => c.startsWith('bg-'))
      expect(bgClass1).toBe(bgClass2)
    })

    it('異なる名前は異なる色の可能性がある', () => {
      const wrapper1 = mount(Avatar, { props: { name: 'Alice' } })
      const wrapper2 = mount(Avatar, { props: { name: 'Bob' } })

      const classes1 = wrapper1.find('.rounded-full.flex').classes()
      const classes2 = wrapper2.find('.rounded-full.flex').classes()

      const bgClass1 = classes1.find((c) => c.startsWith('bg-'))
      const bgClass2 = classes2.find((c) => c.startsWith('bg-'))

      // 確率的に異なる（ハッシュベース）
      expect(bgClass1).toBeDefined()
      expect(bgClass2).toBeDefined()
    })
  })

  describe('オンラインインジケーター', () => {
    it('showOnline が false の場合、インジケーターを表示しない', () => {
      const wrapper = mount(Avatar, {
        props: { name: 'Test', showOnline: false },
      })
      expect(wrapper.find('span.absolute').exists()).toBe(false)
    })

    it('showOnline が true, isOnline が true の場合、緑色インジケーターを表示する', () => {
      const wrapper = mount(Avatar, {
        props: { name: 'Test', showOnline: true, isOnline: true },
      })
      const indicator = wrapper.find('span.absolute')
      expect(indicator.exists()).toBe(true)
      expect(indicator.classes()).toContain('bg-green-500')
    })

    it('showOnline が true, isOnline が false の場合、灰色インジケーターを表示する', () => {
      const wrapper = mount(Avatar, {
        props: { name: 'Test', showOnline: true, isOnline: false },
      })
      const indicator = wrapper.find('span.absolute')
      expect(indicator.exists()).toBe(true)
      expect(indicator.classes()).toContain('bg-gray-400')
    })
  })

  describe('ボーダー', () => {
    it('showBorder が true の場合、ring クラスを適用する', () => {
      const wrapper = mount(Avatar, {
        props: { name: 'Test', showBorder: true },
      })
      const el = wrapper.find('.rounded-full')
      expect(el.classes()).toContain('ring-1')
    })

    it('showBorder が false の場合、ring クラスを適用しない', () => {
      const wrapper = mount(Avatar, {
        props: { name: 'Test', showBorder: false },
      })
      const el = wrapper.find('.rounded-full')
      expect(el.classes()).not.toContain('ring-1')
    })
  })
})
