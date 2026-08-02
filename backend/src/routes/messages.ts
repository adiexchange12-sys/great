import { Router, Response } from 'express'
import { z } from 'zod'
import prisma from '../config/database.js'
import { AuthRequest, authMiddleware } from '../middleware/auth.js'

const router = Router()

const sendMessageSchema = z.object({
  chatId: z.string(),
  content: z.string().min(1),
  messageType: z.enum(['text', 'image', 'video', 'audio', 'voice']).default('text'),
  senderType: z.enum(['visitor', 'agent', 'system']),
  metadata: z.any().optional()
})

router.post('/send', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { chatId, content, messageType, senderType, metadata } = sendMessageSchema.parse(req.body)
    
    const chat = await prisma.chat.findUnique({
      where: { chatId }
    })
    
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' })
    }
    
    const message = await prisma.message.create({
      data: {
        messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        content,
        messageType,
        senderType,
        senderId: req.agent!.id,
        chatId: chat.id,
        metadata
      },
      include: {
        attachments: true
      }
    })
    
    await prisma.chat.update({
      where: { id: chat.id },
      data: { updatedAt: new Date() }
    })
    
    res.status(201).json(message)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message })
    }
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/chat/:chatId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { page = '1', limit = '50' } = req.query as { page?: string; limit?: string }
    
    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)
    const skip = (pageNum - 1) * limitNum
    
    const chat = await prisma.chat.findUnique({
      where: { chatId: req.params.chatId }
    })
    
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' })
    }
    
    const messages = await prisma.message.findMany({
      where: { chatId: chat.id },
      include: {
        attachments: true
      },
      orderBy: { createdAt: 'asc' },
      skip,
      take: limitNum
    })
    
    const total = await prisma.message.count({
      where: { chatId: chat.id }
    })
    
    res.json({
      messages,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    })
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.patch('/:messageId/read', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const message = await prisma.message.update({
      where: { id: req.params.messageId },
      data: { isRead: true }
    })
    
    res.json(message)
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
