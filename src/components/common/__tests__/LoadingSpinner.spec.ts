import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import LoadingSpinner from '../LoadingSpinner.vue'

describe('LoadingSpinner', () => {
  describe('サイズ', () => {
    it('デフォルトサイズは md (w-8 h-8)', () => {
      const wrapper = mount(LoadingSpinner)
      const spinner = wrapper.find('.animate-spin')
      expect(spinner.classes()).toContain('w-8')
      expect(spinner.classes()).toContain('h-8')
    })

    it('size="sm" の場合、w-4 h-4', () => {
      const wrapper = mount(LoadingSpinner, { props: { size: 'sm' } })
      const spinner = wrapper.find('.animate-spin')
      expect(spinner.classes()).toContain('w-4')
      expect(spinner.classes()).toContain('h-4')
    })

    it('size="lg" の場合、w-12 h-12', () => {
      const wrapper = mount(LoadingSpinner, { props: { size: 'lg' } })
      const spinner = wrapper.find('.animate-spin')
      expect(spinner.classes()).toContain('w-12')
      expect(spinner.classes()).toContain('h-12')
    })
  })

  describe('カラー', () => {
    it('デフォルトカラーは text-slack-purple', () => {
      const wrapper = mount(LoadingSpinner)
      const spinner = wrapper.find('.animate-spin')
      expect(spinner.classes()).toContain('text-slack-purple')
    })

    it('カスタムカラーを適用する', () => {
      const wrapper = mount(LoadingSpinner, { props: { color: 'text-blue-500' } })
      const spinner = wrapper.find('.animate-spin')
      expect(spinner.classes()).toContain('text-blue-500')
    })
  })

  describe('アクセシビリティ', () => {
    it('role="status" を持つ', () => {
      const wrapper = mount(LoadingSpinner)
      const spinner = wrapper.find('[role="status"]')
      expect(spinner.exists()).toBe(true)
    })

    it('aria-label="読み込み中" を持つ', () => {
      const wrapper = mount(LoadingSpinner)
      const spinner = wrapper.find('[aria-label="読み込み中"]')
      expect(spinner.exists()).toBe(true)
    })
  })

  describe('SVG 構造', () => {
    it('SVG 要素を含む', () => {
      const wrapper = mount(LoadingSpinner)
      expect(wrapper.find('svg').exists()).toBe(true)
    })

    it('circle と path 要素を含む', () => {
      const wrapper = mount(LoadingSpinner)
      expect(wrapper.find('circle').exists()).toBe(true)
      expect(wrapper.find('path').exists()).toBe(true)
    })
  })

  describe('アニメーション', () => {
    it('animate-spin クラスを持つ', () => {
      const wrapper = mount(LoadingSpinner)
      expect(wrapper.find('.animate-spin').exists()).toBe(true)
    })
  })
})
