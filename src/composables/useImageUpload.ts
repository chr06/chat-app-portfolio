import { ref, readonly } from 'vue'
import imageCompression from 'browser-image-compression'
import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
} from 'firebase/storage'
import { storage, auth } from '@/firebase/config'

interface UploadResult {
  url: string
  path: string
}

export function useImageUpload() {
  const isUploading = ref(false)
  const uploadProgress = ref(0)
  const error = ref<Error | null>(null)

  /**
   * 画像を圧縮
   */
  async function compressImage(file: File): Promise<File> {
    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      fileType: file.type as 'image/jpeg' | 'image/png' | 'image/webp',
    }

    try {
      const compressedFile = await imageCompression(file, options)
      console.log(
        `Image compressed: ${(file.size / 1024 / 1024).toFixed(2)}MB -> ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`
      )
      return compressedFile
    } catch (e) {
      console.error('Error compressing image:', e)
      // 圧縮に失敗した場合は元のファイルを返す
      return file
    }
  }

  /**
   * Firebase Storage に画像をアップロード
   */
  async function uploadImage(file: File): Promise<UploadResult> {
    const currentUser = auth.currentUser
    if (!currentUser) {
      throw new Error('ログインが必要です')
    }

    isUploading.value = true
    uploadProgress.value = 0
    error.value = null

    try {
      // 画像を圧縮
      const compressedFile = await compressImage(file)

      // ファイル名を生成（タイムスタンプ + ランダム文字列）
      const timestamp = Date.now()
      const randomStr = Math.random().toString(36).substring(2, 8)
      const extension = file.name.split('.').pop() || 'jpg'
      const fileName = `${timestamp}_${randomStr}.${extension}`

      // Storage パス
      const path = `images/${currentUser.uid}/${fileName}`
      const imageRef = storageRef(storage, path)

      // アップロード
      const uploadTask = uploadBytesResumable(imageRef, compressedFile)

      return new Promise((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            // 進捗更新
            uploadProgress.value = Math.round(
              (snapshot.bytesTransferred / snapshot.totalBytes) * 100
            )
          },
          (err) => {
            // エラー
            error.value = err
            isUploading.value = false
            reject(err)
          },
          async () => {
            // 完了
            try {
              const url = await getDownloadURL(uploadTask.snapshot.ref)
              isUploading.value = false
              uploadProgress.value = 100
              resolve({ url, path })
            } catch (e) {
              error.value = e as Error
              isUploading.value = false
              reject(e)
            }
          }
        )
      })
    } catch (e) {
      error.value = e as Error
      isUploading.value = false
      throw e
    }
  }

  /**
   * 画像を圧縮してアップロード（一括処理）
   */
  async function compressAndUpload(file: File): Promise<UploadResult> {
    return uploadImage(file)
  }

  return {
    isUploading: readonly(isUploading),
    uploadProgress: readonly(uploadProgress),
    error: readonly(error),
    compressImage,
    uploadImage,
    compressAndUpload,
  }
}
