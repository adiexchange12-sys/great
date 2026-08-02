# Live Chat Application

A full-stack WhatsApp-style live chat application with admin panel.

## Features
- Real-time messaging via Socket.IO
- Image/audio/video sharing
- Audio calling UI with WebRTC signaling
- Mobile responsive design
- Unread message notifications
- Visitor logout and admin back navigation

## Tech Stack
- **Backend**: Node.js, Express, Prisma, Socket.IO
- **Frontend**: React, Vite, Tailwind CSS
- **Admin Panel**: React, Vite, Tailwind CSS
- **Database**: SQLite (dev), PostgreSQL (production)

## Local Development

### Prerequisites
- Node.js 18+
- npm or yarn

### Setup
1. Clone the repo
2. Install dependencies:
   ```bash
   npm install
   cd backend && npm install && cd ..
   cd frontend && npm install && cd ..
   cd admin && npm install && cd ..
   ```
3. Set up environment variables (see `.env.example` in backend)
4. Run database migrations:
   ```bash
   cd backend && npx prisma migrate dev && cd ..
   ```
5. Start development servers:
   ```bash
   # Backend (port 3001)
   cd backend && npm run dev
   
   # Frontend (port 5173)
   cd frontend && npm run dev
   
   # Admin Panel (port 5174)
   cd admin && npm run dev
   ```

## Deployment

### Backend (Render.com)
1. Sign up at [render.com](https://render.com)
2. Create a new Web Service
3. Connect your GitHub repo
4. Set the following:
   - **Build Command**: `cd backend && npm install && npx prisma generate`
   - **Start Command**: `cd backend && npx tsx src/index.ts`
   - **Plan**: Free
5. Add environment variables:
   - `DATABASE_URL`: `file:./dev.db` (or PostgreSQL URL for production)
   - `JWT_SECRET`: Generate a strong random string
   - `JWT_REFRESH_SECRET`: Generate another strong random string
   - `PORT`: `3001`
   - `UPLOAD_DIR`: `./uploads`
   - `MAX_FILE_SIZE`: `104857600`
   - `CORS_ORIGIN`: `*` (or your frontend domain)
6. Deploy

### Frontend (Vercel)
1. Sign up at [vercel.com](https://vercel.com)
2. Import your GitHub repo
3. Set the following:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Add environment variable:
   - `VITE_API_URL`: `https://your-backend-url.onrender.com`
5. Deploy

### Admin Panel (Vercel)
1. Import your GitHub repo
2. Set the following:
   - **Framework Preset**: Vite
   - **Root Directory**: `admin`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Add environment variable:
   - `VITE_API_URL`: `https://your-backend-url.onrender.com`
4. Deploy

## Default Admin Credentials
- Email: `admin@livechat.com`
- Password: `admin123`

## Production Notes
- Use PostgreSQL instead of SQLite for production
- Set up Cloudinary or AWS S3 for file uploads
- Enable HTTPS for WebSocket connections
- Configure proper CORS origins
