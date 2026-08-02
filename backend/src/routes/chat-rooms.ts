import { Router, Response } from 'express'
import { z } from 'zod'
import prisma from '../config/database.js'
import { AuthRequest, authMiddleware, requireRole } from '../middleware/auth.js'

const router = Router()

const createChatRoomSchema = z.object({
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  subject: z.string().min(1).max(100).optional()
})

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const chatRooms = await prisma.chat.findMany({
      where: {
        slug: { not: null }
      },
      select: {
        id: true,
        chatId: true,
        slug: true,
        subject: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { messages: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    
    res.json(chatRooms)
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/', authMiddleware, requireRole('admin', 'super_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { slug, subject } = createChatRoomSchema.parse(req.body)
    
    const existingRoom = await prisma.chat.findFirst({
      where: { slug }
    })
    
    if (existingRoom) {
      return res.status(409).json({ error: 'Chat room with this slug already exists' })
    }
    
    const chatRoom = await prisma.chat.create({
      data: {
        chatId: `room_${Date.now()}`,
        slug,
        subject,
        status: 'open'
      },
      select: {
        id: true,
        chatId: true,
        slug: true,
        subject: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    })
    
    res.status(201).json(chatRoom)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message })
    }
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
