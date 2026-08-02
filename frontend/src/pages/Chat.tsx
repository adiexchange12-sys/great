import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { io, Socket } from 'socket.io-client'
import { Send, Paperclip, Mic, Smile, Phone, Video, MoreVertical, X, CheckCheck } from 'lucide-react'
import EmojiPicker from '@emoji-mart/react'
import data from '@emoji-mart/data'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface Message {
  id: string
  content: string
  messageType: string
  senderType: string
  isRead: boolean
  isDelivered: boolean
  createdAt: string
}

interface Visitor {
  id: string
  visitorId: string
  name: string | null
  email: string | null
  mobile: string | null
  isOnline: boolean
}

interface Chat {
  id: string
  chatId: string
  slug?: string
  status: string
}

export default function Chat() {
  const { slug = '' } = useParams()
  const [step, setStep] = useState<'pre-chat' | 'name' | 'chat'>('pre-chat')
  const [visitor, setVisitor] = useState<Visitor | null>(null)
  const [chat, setChat] = useState<Chat | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [isInCall, setIsInCall] = useState(false)
  const [isCalling, setIsCalling] = useState(false)
  const [newMessageNotification, setNewMessageNotification] = useState<string | null>(null)
  const hasJoinedChatRef = useRef(false)
  const chatRef = useRef<Chat | null>(null)
  const visitorRef = useRef<Visitor | null>(null)
  
  const socketRef = useRef<Socket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const localAudioRef = useRef<HTMLAudioElement>(null)
  const remoteAudioRef = useRef<HTMLAudioElement>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    const storedVisitor = localStorage.getItem('visitor')
    if (storedVisitor) {
      setVisitor(JSON.parse(storedVisitor))
      setStep('chat')
    }
  }, [])

  const createVisitor = async (name?: string, email?: string, mobile?: string) => {
    try {
      const res = await fetch(`${API_URL}/api/visitors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name || null, email: email || null, mobile: mobile || null })
      })
      const data = await res.json()
      setVisitor(data)
      localStorage.setItem('visitor', JSON.stringify(data))
      
      const roomSlug = slug || 'default'
      await joinChatBySlug(data.visitorId, roomSlug)
      
      return data
    } catch (error) {
      console.error('Failed to create visitor:', error)
    }
  }

  const joinChatBySlug = async (visitorId: string, slug: string) => {
    try {
      const res = await fetch(`${API_URL}/api/chats/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitorId, slug })
      })
      const data = await res.json()
      setChat(data)
      
      if (data.messages && data.messages.length > 0) {
        setMessages(data.messages)
      } else {
        setMessages(getDemoMessages())
      }
      
      setStep('chat')
    } catch (error) {
      console.error('Failed to join chat:', error)
    }
  }

  useEffect(() => {
    chatRef.current = chat
  }, [chat])

  useEffect(() => {
    visitorRef.current = visitor
  }, [visitor])

  useEffect(() => {
    if (step !== 'chat' || !visitor) return

    const socket = io(API_URL, {
      auth: { visitorId: visitor.visitorId },
      transports: ['websocket', 'polling']
    })

    socketRef.current = socket

    const joinChatRoom = () => {
      if (chatRef.current && !hasJoinedChatRef.current) {
        console.log('Joining chat room:', chatRef.current.chatId)
        socket.emit('visitor:join-chat', chatRef.current.chatId)
        hasJoinedChatRef.current = true
      }
    }

    socket.on('connect', () => {
      console.log('Connected to chat server')
      setIsConnected(true)
      joinChatRoom()
    })

    socket.on('disconnect', () => {
      console.log('Disconnected from chat server')
      setIsConnected(false)
    })

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error)
      setIsConnected(false)
    })

    socket.on('message:new', (data: any) => {
      console.log('Client received message:new:', data)
      const incoming = data.message
      const isFromAgent = incoming.senderType === 'agent'
      
      setMessages(prev => {
        const exists = prev.find(msg => msg.id === incoming.id)
        let updated
        if (exists) {
          updated = prev.map(msg => msg.id === incoming.id ? incoming : msg)
        } else {
          const filtered = prev.filter(msg => 
            !(msg.id.startsWith('temp-') && 
              msg.content === incoming.content && 
              msg.senderType === incoming.senderType &&
              msg.messageType === incoming.messageType)
          )
          updated = [...filtered, incoming]
        }
          const sorted = updated.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
          const latest = sorted[sorted.length - 1]
          if (latest && isFromAgent && latest.id === incoming.id) {
            setNewMessageNotification(null)
          } else if (latest && !isFromAgent && latest.id === incoming.id) {
            setNewMessageNotification(incoming.content)
          }
          return sorted
      })
    })

    socket.on('error', (error: any) => {
      console.error('Socket error:', error)
    })

    socket.on('call:incoming', async (data: any) => {
      const pc = setupPeerConnection()
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (localAudioRef.current) {
        localAudioRef.current.srcObject = stream
      }
      
      stream.getTracks().forEach(track => pc.addTrack(track, stream))
      
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer))
      
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      
      socket.emit('call:answer', {
        chatId: data.chatId,
        answer
      })
      
      setIsInCall(true)
    })

    socket.on('call:answer', async (data: any) => {
      const pc = peerConnectionRef.current
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer))
      }
    })

    socket.on('call:ice-candidate', async (data: any) => {
      const pc = peerConnectionRef.current
      if (pc && data.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate))
      }
    })

    socket.on('call:end', () => {
      endCall()
    })

    return () => {
      socket.disconnect()
      setIsConnected(false)
      hasJoinedChatRef.current = false
    }
  }, [step, visitor])

  useEffect(() => {
    if (!chat || !socketRef.current?.connected) return
    
    console.log('Chat changed, joining chat room:', chat.chatId)
    socketRef.current.emit('visitor:join-chat', chat.chatId)
    hasJoinedChatRef.current = true
  }, [chat])

  const sendMessage = async () => {
    console.log('Client sendMessage called:', { 
      hasInput: !!inputMessage.trim(), 
      hasChat: !!chat, 
      connected: socketRef.current?.connected,
      socketId: socketRef.current?.id
    })
    
    if (!inputMessage.trim() || !chat || !socketRef.current?.connected) {
      console.log('Client sendMessage early return')
      return
    }

    const content = inputMessage.trim()
    const tempId = `temp-${Date.now()}`
    
    const optimisticMessage: Message = {
      id: tempId,
      content,
      messageType: 'text',
      senderType: 'visitor',
      isRead: false,
      isDelivered: true,
      createdAt: new Date().toISOString()
    }

    setMessages(prev => [...prev, optimisticMessage])
    setInputMessage('')
    setNewMessageNotification(null)
    scrollToBottom()

    try {
      console.log('Client emitting visitor:send-message:', { chatId: chat.chatId, content })
      socketRef.current.emit('visitor:send-message', {
        chatId: chat.chatId,
        content,
        messageType: 'text'
      })
      console.log('Client visitor:send-message emitted')
    } catch (error) {
      console.error('Client failed to send message:', error)
      setMessages(prev => prev.filter(msg => msg.id !== tempId))
    }
  }

  const handleFileUpload = async (file: File) => {
    console.log('File selected:', file.name, file.type, file.size)
    if (!visitor || !chat) {
      console.log('No visitor or chat')
      return
    }

    const tempId = `temp-${Date.now()}`
    const messageType = getMessageTypeFromFile(file)

    const optimisticMessage: Message = {
      id: tempId,
      content: 'Uploading...',
      messageType: messageType || 'image',
      senderType: 'visitor',
      isRead: false,
      isDelivered: true,
      createdAt: new Date().toISOString()
    }

    setMessages(prev => [...prev, optimisticMessage])
    scrollToBottom()

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('chatId', chat.chatId)

      console.log('Uploading file to:', `${API_URL}/api/upload`)
      const res = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        headers: {},
        body: formData
      })
      
      console.log('Upload response:', res.status)
      const data = await res.json()
      console.log('Upload response data:', data)
      
      if (data.url) {
        const fullUrl = data.url.startsWith('http') ? data.url : `${API_URL}${data.url}`
        setMessages((prev) => {
          return prev.map((msg) => {
            if (msg.id === tempId) {
              return { ...msg, content: fullUrl, messageType: data.messageType }
            }
            return msg
          })
        })

        console.log('Emitting visitor:send-message with image')
        if (socketRef.current) {
          socketRef.current.emit('visitor:send-message', {
            chatId: chat.chatId,
            content: fullUrl,
            messageType: data.messageType
          })
        }
        console.log('Image message emitted')
      } else {
        console.log('No url in response')
        setMessages((prev) => prev.filter((msg) => msg.id !== tempId))
      }
    } catch (error) {
      console.error('Failed to upload file:', error)
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId))
    }
  }

  const getMessageTypeFromFile = (file: File): string => {
    if (file.type.startsWith('image/')) return 'image'
    if (file.type.startsWith('video/')) return 'video'
    if (file.type.startsWith('audio/')) return 'audio'
    return 'file'
  }

  const getFullUrl = (url: string) => {
    if (!url) return url
    if (url.startsWith('http')) return url
    return `${API_URL}${url}`
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      const chunks: Blob[] = []

      mediaRecorder.ondataavailable = (event) => {
        chunks.push(event.data)
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' })
        const file = new File([blob], 'voice-note.webm', { type: 'audio/webm' })
        handleFileUpload(file)
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start()
      setIsRecording(true)
    } catch (error) {
      console.error('Failed to start recording:', error)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const addEmoji = (emoji: any) => {
    setInputMessage(prev => prev + emoji.native)
    setShowEmoji(false)
  }

  const startCall = async () => {
    try {
      setIsCalling(true)
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      if (localAudioRef.current) {
        localAudioRef.current.srcObject = stream
      }
      
      const offer = await peerConnectionRef.current?.createOffer()
      await peerConnectionRef.current?.setLocalDescription(offer)
      
      socketRef.current?.emit('call:offer', {
        chatId: chat?.chatId,
        offer
      })
    } catch (error) {
      console.error('Failed to start call:', error)
      setIsCalling(false)
    }
  }

  const endCall = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }
    
    setIsInCall(false)
    setIsCalling(false)
  }

  const setupPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    })
    
    pc.ontrack = (event) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = event.streams[0]
      }
    }
    
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit('call:ice-candidate', {
          chatId: chat?.chatId,
          candidate: event.candidate
        })
      }
    }
    
    peerConnectionRef.current = pc
    return pc
  }

  const getRoomName = () => {
    if (slug) {
      return slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, ' ')
    }
    return 'Support Chat'
  }

  const handleLogout = () => {
    localStorage.removeItem('visitor')
    setVisitor(null)
    setChat(null)
    setMessages([])
    setStep('pre-chat')
    setInputMessage('')
    if (socketRef.current?.connected) {
      socketRef.current.disconnect()
    }
  }

  const getDemoMessages = (): Message[] => {
    const now = new Date()
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000)
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    
    return [
      {
        id: 'demo-1',
        content: 'Hello! 👋 Welcome to our live chat. How can I help you today?',
        messageType: 'text',
        senderType: 'agent',
        isRead: true,
        isDelivered: true,
        createdAt: oneHourAgo.toISOString()
      },
      {
        id: 'demo-2',
        content: 'Hi there! I have a question about your services.',
        messageType: 'text',
        senderType: 'visitor',
        isRead: true,
        isDelivered: true,
        createdAt: oneHourAgo.toISOString()
      },
      {
        id: 'demo-3',
        content: 'Sure! I\'d be happy to help you with that. What would you like to know?',
        messageType: 'text',
        senderType: 'agent',
        isRead: true,
        isDelivered: true,
        createdAt: tenMinutesAgo.toISOString()
      },
      {
        id: 'demo-4',
        content: 'Can you tell me more about your pricing plans?',
        messageType: 'text',
        senderType: 'visitor',
        isRead: true,
        isDelivered: true,
        createdAt: fiveMinutesAgo.toISOString()
      }
    ]
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today'
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
    }
  }

  const shouldShowDateSeparator = (currentMessage: Message, previousMessage: Message | null) => {
    if (!previousMessage) return true
    const currentDate = new Date(currentMessage.createdAt).toDateString()
    const previousDate = new Date(previousMessage.createdAt).toDateString()
    return currentDate !== previousDate
  }

  if (step === 'pre-chat') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50">
        <div className="max-w-md w-full mx-4 p-8 bg-white rounded-2xl shadow-2xl animate-scale-in">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse-soft">
              <span className="text-white text-3xl">💬</span>
            </div>
            <h1 className="text-3xl font-bold mb-2 text-gray-800">Welcome to {getRoomName()}</h1>
            <p className="text-gray-600">
              How can we help you today?
            </p>
          </div>
          <div className="space-y-4">
            <button
              onClick={() => createVisitor()}
              className="w-full py-4 px-6 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all duration-300 hover:scale-105 hover:shadow-lg"
            >
              Start Chatting
            </button>
            <button
              onClick={() => setStep('name')}
              className="w-full py-4 px-6 border-2 border-gray-300 hover:border-gray-400 rounded-lg font-medium transition-all duration-300 hover:scale-105"
            >
              Continue with Name
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'name') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50">
        <div className="max-w-md w-full mx-4 p-8 bg-white rounded-2xl shadow-2xl animate-scale-in">
          <h2 className="text-2xl font-bold mb-6 text-gray-800">Enter your details</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const formData = new FormData(e.target)
              createVisitor(
                formData.get('name') as string,
                formData.get('email') as string,
                formData.get('mobile') as string
              )
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">Name (optional)</label>
              <input
                type="text"
                name="name"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all duration-200"
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">Mobile Number (optional)</label>
              <input
                type="tel"
                name="mobile"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all duration-200"
                placeholder="+91 98765 43210"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">Email (optional)</label>
              <input
                type="email"
                name="email"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all duration-200"
                placeholder="your@email.com"
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 px-6 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all duration-300 hover:scale-105 hover:shadow-lg"
            >
              Start Chat
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <div className="w-full max-w-4xl h-[700px] bg-white rounded-lg shadow-2xl flex flex-col overflow-hidden animate-scale-in">
        <div className="bg-green-700 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
              <span className="text-green-700 font-semibold text-lg">💬</span>
            </div>
            <div>
              <h3 className="font-semibold">{getRoomName()}</h3>
              <p className="text-xs text-green-100">
                {isConnected ? 'Online' : 'Connecting...'}
                {isInCall && ' • 📞 In Call'}
                {isCalling && ' • Calling...'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-red-600 rounded-full transition-all duration-200 hover:scale-110"
              title="Logout"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
            <button
              onClick={isInCall ? endCall : startCall}
              className={`p-2 rounded-full transition-all duration-200 hover:scale-110 ${
                isInCall 
                  ? 'bg-red-600 hover:bg-red-700 text-white' 
                  : 'hover:bg-green-600 text-white'
              }`}
              title={isInCall ? 'End Call' : 'Start Call'}
            >
              <Phone className="w-5 h-5" />
            </button>
            <button className="p-2 hover:bg-green-600 rounded-full transition-all duration-200 hover:scale-110">
              <Video className="w-5 h-5" />
            </button>
            <button className="p-2 hover:bg-green-600 rounded-full transition-all duration-200 hover:scale-110">
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
        </div>

        <audio ref={localAudioRef} autoPlay muted />
        <audio ref={remoteAudioRef} autoPlay />

        {newMessageNotification && (
          <div className="bg-green-600 text-white px-4 py-3 flex items-center justify-between animate-fade-in">
            <div className="flex items-center gap-2">
              <span className="text-lg">💬</span>
              <div>
                <p className="text-sm font-medium">New message</p>
                <p className="text-xs text-green-100 truncate max-w-[300px]">{newMessageNotification}</p>
              </div>
            </div>
            <button
              onClick={() => setNewMessageNotification(null)}
              className="p-1 hover:bg-green-700 rounded-full transition-all duration-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
          {messages.length === 0 && (
            <div className="text-center py-12 animate-fade-in">
              <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white text-2xl">💬</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Welcome to {getRoomName()}</h3>
              <p className="text-gray-600">Start a conversation with our support team</p>
            </div>
          )}
          
          {messages.map((message, index) => {
            const previousMessage = index > 0 ? messages[index - 1] : null
            const showDateSeparator = shouldShowDateSeparator(message, previousMessage)
            const isVisitor = message.senderType === 'visitor'
            
            return (
              <div key={message.id} className="animate-fade-in">
                {showDateSeparator && (
                  <div className="flex items-center justify-center my-4">
                    <span className="bg-gray-200 text-gray-600 text-xs px-4 py-1 rounded-full">
                      {formatDate(message.createdAt)}
                    </span>
                  </div>
                )}
                <div
                  className={`flex ${isVisitor ? 'justify-end' : 'justify-start'} mb-2`}
                >
                  <div
                    className={`max-w-[70%] px-4 py-2 rounded-lg shadow-sm ${
                      isVisitor
                        ? 'bg-green-600 text-white'
                        : 'bg-white text-gray-800'
                    }`}
                  >
                    {message.messageType === 'image' && (
                      <img src={getFullUrl(message.content)} alt="Uploaded" className="rounded-lg mb-1 max-w-full" />
                    )}
                    {message.messageType === 'video' && (
                      <video src={getFullUrl(message.content)} controls className="rounded-lg mb-1 max-w-full" />
                    )}
                    {(message.messageType === 'audio' || message.messageType === 'voice') && (
                      <audio src={getFullUrl(message.content)} controls className="mb-1" />
                    )}
                    {message.messageType === 'text' && (
                      <p className="text-sm">{message.content}</p>
                    )}
                    <div className={`flex items-center gap-1 mt-1 text-xs ${isVisitor ? 'text-green-100' : 'text-gray-500'}`}>
                      <span>{formatTime(message.createdAt)}</span>
                      {isVisitor && (
                        <CheckCheck className="w-3 h-3" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          
          <div ref={messagesEndRef} />
        </div>

        <div className="bg-gray-100 p-3 flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,audio/*"
            onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 hover:bg-gray-200 rounded-full transition-all duration-200 hover:scale-110"
          >
            <Paperclip className="w-5 h-5 text-gray-600" />
          </button>
          
          <button
            onClick={() => setShowEmoji(!showEmoji)}
            className="p-2 hover:bg-gray-200 rounded-full transition-all duration-200 hover:scale-110"
          >
            <Smile className="w-5 h-5 text-gray-600" />
          </button>
          
          {showEmoji && (
            <div className="absolute bottom-20 left-4 z-10 animate-scale-in">
              <EmojiPicker data={data} onEmojiSelect={addEmoji} />
            </div>
          )}
          
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 rounded-full border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all duration-200"
          />
          
          {isRecording ? (
            <button
              onClick={stopRecording}
              className="p-2 rounded-full bg-red-600 hover:bg-red-700 text-white transition-all duration-200 hover:scale-110"
            >
              <Mic className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={startRecording}
              className="p-2 hover:bg-gray-200 rounded-full transition-all duration-200 hover:scale-110"
            >
              <Mic className="w-5 h-5 text-gray-600" />
            </button>
          )}
          
          <button
            onClick={sendMessage}
            disabled={!inputMessage.trim()}
            className="p-2 rounded-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white transition-all duration-200 hover:scale-110 disabled:hover:scale-100"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
