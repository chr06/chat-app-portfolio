# chat-app-portfolio

Vue 3 + Vite で構築した Slack 風チャットアプリケーションです。

## 推奨 IDE 設定

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar)（Vetur は無効にしてください）

## 推奨ブラウザ設定

- Chromium 系ブラウザ（Chrome, Edge, Brave など）:
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Chrome DevTools でカスタムオブジェクトフォーマッターを有効にする](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Firefox DevTools でカスタムオブジェクトフォーマッターを有効にする](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## `.vue` インポートの TypeScript 型サポート

TypeScript はデフォルトで `.vue` インポートの型情報を扱えないため、型チェックには `tsc` の代わりに `vue-tsc` を使用しています。エディタでは [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) を導入することで、TypeScript の言語サービスが `.vue` の型を認識できるようになります。

## カスタム設定

[Vite 設定リファレンス](https://vite.dev/config/) を参照してください。

## プロジェクトセットアップ

```sh
npm install
```

### 開発サーバーの起動（ホットリロード付き）

```sh
npm run dev
```

### 本番用の型チェック・コンパイル・ミニファイ

```sh
npm run build
```

### [Vitest](https://vitest.dev/) でユニットテストを実行

```sh
npm run test:unit
```

### [Playwright](https://playwright.dev) で E2E テストを実行

```sh
# 初回実行時にブラウザをインストール
npx playwright install

# CI でテストする場合は先にビルドが必要
npm run build

# E2E テストを実行
npm run test:e2e
# Chromium のみでテストを実行
npm run test:e2e -- --project=chromium
# 特定のファイルのテストを実行
npm run test:e2e -- tests/example.spec.ts
# デバッグモードでテストを実行
npm run test:e2e -- --debug
```

### [ESLint](https://eslint.org/) でリント

```sh
npm run lint
```
