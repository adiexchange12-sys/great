# Live Chat Platform

Independent live chat platform built with Node.js, Express, React, and PostgreSQL.

## Features

- Chat rooms with shareable links
- Real-time messaging via WebSocket
- Multi-format file uploads (images, videos, audio)
- Visitor authentication (no login required)
- Agent authentication with JWT
- Admin dashboard with statistics
- Dark mode support
- Emoji picker
- Voice notes recording
- Typing indicators
- Online/Offline status
- Message read receipts
- Docker deployment ready

## Prerequisites

- Node.js 20+
- PostgreSQL 16+
- Docker & Docker Compose (optional)

## Quick Start with Docker

1. Clone the repository
2. Set environment variables in `.env` file or use defaults
3. Run:

```bash
docker-compose up -d
```

The application will be available at:
- Frontend: http://localhost
- Admin Dashboard: http://localhost:5174
- Backend API: http://localhost:3001

## Manual Setup

### 1. Database Setup

```bash
# Create PostgreSQL database
createdb livechat
```

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Run database migrations
npm run db:generate
npm run db:migrate

# Seed database with admin user
npm run db:seed

# Start development server
npm run dev
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

### 4. Admin Dashboard Setup

```bash
cd admin

# Install dependencies
npm install

# Start development server
npm run dev
```

## Default Admin Credentials

- Email: admin@livechat.com
- Password: admin123

## Environment Variables

### Backend (.env)

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/livechat
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key
PORT=3001
UPLOAD_DIR=uploads
MAX_FILE_SIZE=104857600
CORS_ORIGIN=http://localhost:5173
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Agent login
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout
- `POST /api/auth/create-agent` - Create new agent (admin only)

### Visitors
- `POST /api/visitors` - Create visitor
- `GET /api/visitors/:visitorId` - Get visitor details
- `PUT /api/visitors/:visitorId/online` - Update online status

### Chats
- `POST /api/chats` - Create chat
- `POST /api/chats/join` - Join/create chat by slug (public)
- `GET /api/chats` - List all chats (with filters)
- `GET /api/chats/:chatId` - Get chat details
- `POST /api/chats/:chatId/close` - Close chat

### Chat Rooms
- `GET /api/admin/chat-rooms` - List all chat rooms
- `POST /api/admin/chat-rooms` - Create new chat room (admin only)

### Messages
- `POST /api/messages/send` - Send message
- `GET /api/messages/chat/:chatId` - Get chat messages
- `PATCH /api/messages/:messageId/read` - Mark message as read

### Upload
- `POST /api/upload` - Upload file

### Admin
- `GET /api/admin/stats` - Get statistics
- `GET /api/admin/chats` - Get all chats
- `GET /api/admin/agents` - Get all agents
- `GET /api/admin/visitors` - Get all visitors

## WebSocket Events

### Client → Server
- `agent:join-chat` - Join a chat room
- `agent:leave-chat` - Leave a chat room
- `agent:send-message` - Send message
- `agent:typing` - Typing indicator on
- `agent:stop-typing` - Typing indicator off
- `visitor:send-message` - Send message (visitor)
- `visitor:typing` - Typing indicator on (visitor)
- `visitor:stop-typing` - Typing indicator off (visitor)

### Server → Client
- `message:new` - New message received
- `typing:agent` - Agent typing indicator
- `typing:visitor` - Visitor typing indicator
- `error` - Error occurred

## Supported File Types

### Images
- JPG, PNG, WEBP

### Videos
- MP4, MOV

### Audio
- MP3, WAV, AAC

### Voice Notes
- Recorded directly from browser (WebM, OGG)

## Security Features

- JWT authentication with refresh tokens
- Helmet security headers
- CORS configuration
- Rate limiting
- Input validation with Zod
- File type validation
- Virus scan ready

## Production Deployment

1. Update environment variables with production values
2. Set strong JWT secrets
3. Configure SSL/TLS certificates
4. Set up reverse proxy (Nginx)
5. Configure firewall rules
6. Set up database backups
7. Enable monitoring

## License

MIT
