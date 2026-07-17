import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'

const useS3 = !!(
  process.env.AWS_ACCESS_KEY_ID &&
  process.env.AWS_SECRET_ACCESS_KEY &&
  process.env.AWS_S3_BUCKET
)

let s3Client = null
if (useS3) {
  s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  })
  console.log('[StorageService] S3 cloud storage enabled.')
} else {
  console.log('[StorageService] AWS credentials not found. Local disk fallback enabled.')
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const LOCAL_UPLOAD_DIR = path.join(__dirname, '../../uploads')

if (!fs.existsSync(LOCAL_UPLOAD_DIR)) {
  fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true })
}

/**
 * Upload a file to storage (AWS S3 or Local Disk)
 * @param {Object} file - The file object from multer (memoryStorage)
 * @returns {Promise<{url: string, fileKey: string}>}
 */
export const uploadToStorage = async (file) => {
  const fileExtension = path.extname(file.originalname)
  const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${fileExtension}`
  
  if (useS3) {
    const bucketName = process.env.AWS_S3_BUCKET
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: uniqueName,
      Body: file.buffer,
      ContentType: file.mimetype
    })
    
    await s3Client.send(command)
    const url = `https://${bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${uniqueName}`
    return { url, fileKey: uniqueName }
  } else {
    const localFilePath = path.join(LOCAL_UPLOAD_DIR, uniqueName)
    await fs.promises.writeFile(localFilePath, file.buffer)
    // Return relative URL that Express will serve as static
    const url = `/api/uploads/${uniqueName}`
    return { url, fileKey: uniqueName }
  }
}

/**
 * Delete a file from storage
 * @param {string} fileKey - Unique identifier/filename of the stored file
 */
export const deleteFromStorage = async (fileKey) => {
  if (!fileKey) return
  
  if (useS3) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: fileKey
      })
      await s3Client.send(command)
      console.log(`[StorageService] Deleted ${fileKey} from S3 bucket.`)
    } catch (error) {
      console.error(`[StorageService] Failed to delete ${fileKey} from S3:`, error)
    }
  } else {
    try {
      const localFilePath = path.join(LOCAL_UPLOAD_DIR, fileKey)
      if (fs.existsSync(localFilePath)) {
        await fs.promises.unlink(localFilePath)
        console.log(`[StorageService] Deleted local file ${fileKey}.`)
      }
    } catch (error) {
      console.error(`[StorageService] Failed to delete local file ${fileKey}:`, error)
    }
  }
}
