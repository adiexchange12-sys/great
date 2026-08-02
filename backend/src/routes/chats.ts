import { Router, Response } from 'express'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import prisma from '../config/database.js'
import { AuthRequest, authMiddleware } from '../middleware/auth.js'

const router = Router()

const createChatSchema = z.object({
  visitorId: z.string(),
  subject: z.string().optional(),
  slug: z.string().optional()
})

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { visitorId, subject, slug } = createChatSchema.parse(req.body)
    
    const visitor = await prisma.visitor.findUnique({
      where: { visitorId }
    })
    
    if (!visitor) {
      return res.status(404).json({ error: 'Visitor not found' })
    }
    
    const existingOpenChat = await prisma.chat.findFirst({
      where: {
        visitorId: visitor.id,
        status: 'open'
      }
    })
    
    if (existingOpenChat) {
      return res.status(409).json({ error: 'Open chat already exists', chat: existingOpenChat })
    }
    
    const chat = await prisma.chat.create({
      data: {
        chatId: `chat_${nanoid(21)}`,
        visitorId: visitor.id,
        subject,
        slug: slug || null,
        agentId: req.agent!.id
      },
      include: {
        visitor: {
          select: {
            id: true,
            visitorId: true,
            name: true,
            email: true,
            isOnline: true
          }
        },
        agent: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })
    
    res.status(201).json(chat)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message })
    }
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/join', async (req, res) => {
  try {
    const schema = z.object({
      visitorId: z.string(),
      slug: z.string()
    })
    
    const { visitorId, slug } = schema.parse(req.body)
    
    const visitor = await prisma.visitor.findUnique({
      where: { visitorId }
    })
    
    if (!visitor) {
      return res.status(404).json({ error: 'Visitor not found' })
    }
    
    let chat = await prisma.chat.findFirst({
      where: {
        visitorId: visitor.id,
        slug,
        status: 'open'
      },
      include: {
        visitor: {
          select: {
            id: true,
            visitorId: true,
            name: true,
            email: true,
            isOnline: true
          }
        },
        agent: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })
    
    if (!chat) {
      chat = await prisma.chat.create({
        data: {
          chatId: `chat_${nanoid(21)}`,
          visitorId: visitor.id,
          slug
        },
        include: {
          visitor: {
            select: {
              id: true,
              visitorId: true,
              name: true,
              email: true,
              isOnline: true
            }
          },
          agent: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      })
    }
    
    const messages = await prisma.message.findMany({
      where: { chatId: chat.id },
      orderBy: { createdAt: 'asc' }
    })
    
    res.json({ ...chat, messages })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message })
    }
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { status, search, slug } = req.query as { status?: string; search?: string; slug?: string }
    
    const where: any = {}
    
    if (status) {
      where.status = status
    }
    
    if (slug) {
      where.slug = slug
    }
    
    if (search) {
      where.OR = [
        { visitor: { name: { contains: search } } },
        { visitor: { email: { contains: search } } },
        { subject: { contains: search } }
      ]
    }
    
    const chats = await prisma.chat.findMany({
      where,
      include: {
        visitor: {
          select: {
            id: true,
            visitorId: true,
            name: true,
            email: true,
            isOnline: true,
            lastSeenAt: true
          }
        },
        agent: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        _count: {
          select: { messages: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    })
    
    res.json(chats)
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/:chatId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const chat = await prisma.chat.findUnique({
      where: { chatId: req.params.chatId },
      include: {
        visitor: {
          select: {
            id: true,
            visitorId: true,
            name: true,
            email: true,
            isOnline: true,
            lastSeenAt: true
          }
        },
        agent: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        _count: {
          select: { messages: true }
        }
      }
    })
    
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' })
    }
    
    res.json(chat)
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/:chatId/close', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const chat = await prisma.chat.update({
      where: { chatId: req.params.chatId },
      data: {
        status: 'closed',
        closedAt: new Date(),
        closedBy: req.agent!.id
      }
    })
    
    res.json(chat)
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
