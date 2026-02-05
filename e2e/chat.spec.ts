import { test, expect } from '@playwright/test'

test.describe('チャット機能（未認証）', () => {
  test('/chat にアクセスするとログインページにリダイレクトされる', async ({ page }) => {
    await page.goto('/chat')

    await page.waitForURL('**/login')
    await expect(page.locator('h1')).toHaveText('Chat App')
    await expect(page.getByText('Googleでログイン')).toBeVisible()
  })

  test('/pending にアクセスするとログインページにリダイレクトされる', async ({ page }) => {
    await page.goto('/pending')

    await page.waitForURL('**/login')
    await expect(page.locator('h1')).toHaveText('Chat App')
  })

  test.describe('認証済みテスト（スキップ）', () => {
    // Google認証は自動化不可のため skip
    test.skip('メッセージ一覧が表示される', async ({ page }) => {
      await page.goto('/chat')
      await expect(page.locator('[data-testid="message-list"]')).toBeVisible()
    })

    test.skip('メッセージを送信できる', async ({ page }) => {
      await page.goto('/chat')
      await page.fill('[data-testid="message-input"]', 'テストメッセージ')
      await page.click('[data-testid="send-button"]')
    })

    test.skip('会話一覧が表示される', async ({ page }) => {
      await page.goto('/chat')
      await expect(page.locator('[data-testid="conversation-list"]')).toBeVisible()
    })
  })
})
