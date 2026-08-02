import { Response, NextFunction } from 'express'
import { verifyAccessToken } from '../utils/auth.js'
import prisma from '../config/database.js'

export interface AuthRequest extends Request {
  agent?: {
    id: string
    email: string
    role: string
  }
}

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  
  const token = authHeader.split(' ')[1]
  
  try {
    const payload = verifyAccessToken(token)
    
    const agent = await prisma.agent.findUnique({
      where: { id: payload.agentId },
      select: { id: true, email: true, role: true, isActive: true }
    })
    
    if (!agent || !agent.isActive) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    
    req.agent = {
      id: agent.id,
      email: agent.email,
      role: agent.role
    }
    
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.agent) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    
    if (!roles.includes(req.agent.role)) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    
    next()
  }
}
