import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { config } from '../config/env.js'
import { nanoid } from 'nanoid'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const uploadDir = path.join(__dirname, '..', '..', config.uploadDir)

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const allowedMimeTypes = {
  image: ['image/jpeg', 'image/png', 'image/webp'],
  video: ['video/mp4', 'video/quicktime'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/aac']
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `${nanoid(21)}${ext}`)
  }
})

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = [...allowedMimeTypes.image, ...allowedMimeTypes.video, ...allowedMimeTypes.audio]
  
  if (allowed.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('File type not allowed'))
  }
}

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.maxFileSize
  }
})

export function getFileCategory(mimeType: string): 'image' | 'video' | 'audio' | null {
  if (allowedMimeTypes.image.includes(mimeType)) return 'image'
  if (allowedMimeTypes.video.includes(mimeType)) return 'video'
  if (allowedMimeTypes.audio.includes(mimeType)) return 'audio'
  return null
}

export function isVoiceNote(file: Express.Multer.File): boolean {
  const ext = path.extname(file.originalname).toLowerCase()
  return ['webm', 'ogg', 'mp3', 'wav'].includes(ext) && file.mimetype.includes('audio')
}

export function getMessageType(file: Express.Multer.File): 'image' | 'video' | 'audio' | 'voice' {
  if (isVoiceNote(file)) return 'voice'
  return getFileCategory(file.mimetype)!
}
