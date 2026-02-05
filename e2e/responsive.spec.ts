import { test, expect } from '@playwright/test'

test.describe('レスポンシブデザイン', () => {
  test.describe('モバイル表示', () => {
    test.use({ viewport: { width: 375, height: 667 } }) // iPhone SE

    test('ログイン画面がモバイルで正しく表示される', async ({ page }) => {
      await page.goto('/login')

      await expect(page.locator('h1')).toHaveText('Chat App')
      await expect(page.getByText('Googleでログイン')).toBeVisible()

      // カードが画面幅に収まっている
      const card = page.locator('.max-w-md')
      await expect(card).toBeVisible()
      const box = await card.boundingBox()
      expect(box).toBeTruthy()
      expect(box!.width).toBeLessThanOrEqual(375)
    })

    test('ログインボタンがタップ可能なサイズ', async ({ page }) => {
      await page.goto('/login')

      const button = page.getByRole('button', { name: 'Googleでログイン' })
      const box = await button.boundingBox()
      expect(box).toBeTruthy()
      // 最低44pxのタッチターゲット
      expect(box!.height).toBeGreaterThanOrEqual(44)
    })
  })

  test.describe('タブレット表示', () => {
    test.use({ viewport: { width: 768, height: 1024 } }) // iPad

    test('ログイン画面がタブレットで正しく表示される', async ({ page }) => {
      await page.goto('/login')

      await expect(page.locator('h1')).toHaveText('Chat App')
      await expect(page.getByText('Googleでログイン')).toBeVisible()

      // カードが中央に配置されている
      const card = page.locator('.max-w-md')
      await expect(card).toBeVisible()
      const box = await card.boundingBox()
      expect(box).toBeTruthy()
      expect(box!.width).toBeLessThan(768)
    })
  })

  test.describe('デスクトップ表示', () => {
    test.use({ viewport: { width: 1280, height: 800 } })

    test('ログイン画面がデスクトップで正しく表示される', async ({ page }) => {
      await page.goto('/login')

      await expect(page.locator('h1')).toHaveText('Chat App')
      await expect(page.getByText('Googleでログイン')).toBeVisible()

      // カードが中央に配置されている
      const card = page.locator('.max-w-md')
      await expect(card).toBeVisible()
      const box = await card.boundingBox()
      expect(box).toBeTruthy()
      // カードが画面幅よりかなり小さい
      expect(box!.width).toBeLessThan(600)
    })

    test('画面が垂直方向に中央配置される', async ({ page }) => {
      await page.goto('/login')

      const container = page.locator('.min-h-screen.flex.items-center')
      await expect(container).toBeVisible()
    })
  })
})
