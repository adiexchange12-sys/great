import { Router, Response } from 'express'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import prisma from '../config/database.js'
import { upload, getMessageType, getFileCategory } from '../utils/upload.js'

const router = Router()

router.post('/',
  upload.single('file'),
  async (req: any, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' })
      }
      
      const { chatId, messageId } = req.body as { chatId?: string; messageId?: string }
      
      const messageType = getMessageType(req.file)
      const fileCategory = getFileCategory(req.file.mimetype)
      
      const protocol = req.protocol
      const host = req.get('host')
      const fileUrl = `${protocol}://${host}/uploads/${req.file.filename}`
      
      let attachment = null
      
      if (messageId) {
        attachment = await prisma.attachment.create({
          data: {
            attachmentId: `att_${nanoid(21)}`,
            originalName: req.file.originalname,
            filename: req.file.filename,
            mimeType: req.file.mimetype,
            size: req.file.size,
            url: fileUrl,
            path: req.file.path,
            messageId,
            isProcessed: false
          }
        })
      }
      
      res.status(201).json({
        url: fileUrl,
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        messageType,
        attachment
      })
    } catch (error) {
      console.error('Upload error:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }
)

export default router
