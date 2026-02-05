import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUploadBytesResumable = vi.fn()
const mockGetDownloadURL = vi.fn()

vi.mock('browser-image-compression', () => ({
  default: vi.fn((file: File) =>
    Promise.resolve(new File(['compressed'], file.name, { type: file.type })),
  ),
}))

vi.mock('firebase/storage', () => ({
  ref: vi.fn(() => 'mock-storage-ref'),
  uploadBytesResumable: (...args: unknown[]) => mockUploadBytesResumable(...args),
  getDownloadURL: (...args: unknown[]) => mockGetDownloadURL(...args),
}))

vi.mock('@/firebase/config', () => ({
  storage: {},
  auth: { currentUser: { uid: 'current-uid' } },
}))

describe('useImageUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  async function loadUseImageUpload() {
    const mod = await import('../useImageUpload')
    return mod.useImageUpload()
  }

  describe('compressImage', () => {
    it('画像を圧縮して返す', async () => {
      const { compressImage } = await loadUseImageUpload()
      const file = new File(['test'], 'photo.jpg', { type: 'image/jpeg' })

      const result = await compressImage(file)

      expect(result).toBeInstanceOf(File)
      expect(result.name).toBe('photo.jpg')
    })

    it('圧縮失敗時は元のファイルを返す', async () => {
      const { default: mockCompression } = await import('browser-image-compression')
      ;(mockCompression as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Compression failed'),
      )

      const { compressImage } = await loadUseImageUpload()
      const file = new File(['test'], 'photo.jpg', { type: 'image/jpeg' })

      const result = await compressImage(file)

      // 元のファイルを返す
      expect(result).toBe(file)
    })
  })

  describe('uploadImage', () => {
    it('画像をアップロードして URL とパスを返す', async () => {
      const mockUploadTask = {
        on: vi.fn(
          (
            _event: string,
            onProgress: (snap: { bytesTransferred: number; totalBytes: number }) => void,
            _onError: (err: Error) => void,
            onComplete: () => void,
          ) => {
            // 進捗をシミュレート
            onProgress({ bytesTransferred: 50, totalBytes: 100 })
            onProgress({ bytesTransferred: 100, totalBytes: 100 })
            onComplete()
          },
        ),
        snapshot: { ref: 'mock-ref' },
      }
      mockUploadBytesResumable.mockReturnValue(mockUploadTask)
      mockGetDownloadURL.mockResolvedValue('https://storage.example.com/image.jpg')

      const { uploadImage, isUploading, uploadProgress } = await loadUseImageUpload()
      const file = new File(['test'], 'photo.jpg', { type: 'image/jpeg' })

      const result = await uploadImage(file)

      expect(result.url).toBe('https://storage.example.com/image.jpg')
      expect(result.path).toMatch(/^images\/current-uid\//)
      expect(isUploading.value).toBe(false)
      expect(uploadProgress.value).toBe(100)
    })

    it('アップロードエラー時にエラーを設定する', async () => {
      const uploadError = new Error('Upload failed')
      const mockUploadTask = {
        on: vi.fn(
          (
            _event: string,
            _onProgress: unknown,
            onError: (err: Error) => void,
          ) => {
            onError(uploadError)
          },
        ),
        snapshot: { ref: 'mock-ref' },
      }
      mockUploadBytesResumable.mockReturnValue(mockUploadTask)

      const { uploadImage, error, isUploading } = await loadUseImageUpload()
      const file = new File(['test'], 'photo.jpg', { type: 'image/jpeg' })

      await expect(uploadImage(file)).rejects.toThrow('Upload failed')
      expect(error.value).toBe(uploadError)
      expect(isUploading.value).toBe(false)
    })

    it('進捗が正しく更新される', async () => {
      const mockUploadTask = {
        on: vi.fn(
          (
            _event: string,
            onProgress: (snap: { bytesTransferred: number; totalBytes: number }) => void,
            _onError: unknown,
            onComplete: () => void,
          ) => {
            onProgress({ bytesTransferred: 25, totalBytes: 100 })
            onProgress({ bytesTransferred: 75, totalBytes: 100 })
            onProgress({ bytesTransferred: 100, totalBytes: 100 })
            onComplete()
          },
        ),
        snapshot: { ref: 'mock-ref' },
      }
      mockUploadBytesResumable.mockReturnValue(mockUploadTask)
      mockGetDownloadURL.mockResolvedValue('https://storage.example.com/image.jpg')

      const { uploadImage, uploadProgress } = await loadUseImageUpload()
      const file = new File(['test'], 'photo.jpg', { type: 'image/jpeg' })

      await uploadImage(file)

      // 最終的な進捗
      expect(uploadProgress.value).toBe(100)
    })
  })

  describe('compressAndUpload', () => {
    it('uploadImage を呼び出す（内部で圧縮も実行）', async () => {
      const mockUploadTask = {
        on: vi.fn(
          (
            _event: string,
            _onProgress: unknown,
            _onError: unknown,
            onComplete: () => void,
          ) => {
            onComplete()
          },
        ),
        snapshot: { ref: 'mock-ref' },
      }
      mockUploadBytesResumable.mockReturnValue(mockUploadTask)
      mockGetDownloadURL.mockResolvedValue('https://storage.example.com/image.jpg')

      const { compressAndUpload } = await loadUseImageUpload()
      const file = new File(['test'], 'photo.jpg', { type: 'image/jpeg' })

      const result = await compressAndUpload(file)

      expect(result.url).toBe('https://storage.example.com/image.jpg')
    })
  })

  // このテストは vi.doMock / vi.resetModules を使うため最後に実行
  describe('認証チェック', () => {
    it('未ログイン時はエラーを投げる', async () => {
      // auth.currentUser を null に上書き
      vi.doMock('@/firebase/config', () => ({
        storage: {},
        auth: { currentUser: null },
      }))

      vi.resetModules()

      // 再度 mock を設定（resetModules 後に必要）
      vi.doMock('browser-image-compression', () => ({
        default: vi.fn(),
      }))
      vi.doMock('firebase/storage', () => ({
        ref: vi.fn(),
        uploadBytesResumable: vi.fn(),
        getDownloadURL: vi.fn(),
      }))

      const mod = await import('../useImageUpload')
      const { uploadImage } = mod.useImageUpload()
      const file = new File(['test'], 'photo.jpg', { type: 'image/jpeg' })

      await expect(uploadImage(file)).rejects.toThrow('ログインが必要です')
    })
  })
})
