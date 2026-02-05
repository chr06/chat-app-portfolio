import { test, expect } from '@playwright/test'

test.describe('認証', () => {
  test('ログイン画面が表示される', async ({ page }) => {
    await page.goto('/login')

    // タイトル
    await expect(page.locator('h1')).toHaveText('Chat App')

    // サブタイトル
    await expect(page.getByText('Slack風チャットアプリ')).toBeVisible()

    // 説明文
    await expect(page.getByText('このアプリは招待制です。')).toBeVisible()

    // Google ログインボタン
    await expect(page.getByText('Googleでログイン')).toBeVisible()
  })

  test('ログインボタンがクリック可能な状態', async ({ page }) => {
    await page.goto('/login')

    const loginButton = page.getByRole('button', { name: 'Googleでログイン' })
    await expect(loginButton).toBeEnabled()
  })

  test('未認証でチャットページにアクセスするとリダイレクトされる', async ({ page }) => {
    await page.goto('/chat')

    // ログインページにリダイレクトされるはず
    await page.waitForURL('**/login')
    await expect(page.locator('h1')).toHaveText('Chat App')
  })

  test('未認証でルートにアクセスするとログインページにリダイレクトされる', async ({ page }) => {
    await page.goto('/')

    // /chat → /login にリダイレクト
    await page.waitForURL('**/login')
    await expect(page.getByText('Googleでログイン')).toBeVisible()
  })

  test('未認証で会話ページにアクセスするとリダイレクトされる', async ({ page }) => {
    await page.goto('/chat/some-conversation-id')

    await page.waitForURL('**/login')
    await expect(page.locator('h1')).toHaveText('Chat App')
  })
})
