import { useState, useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { Send, Paperclip, Mic, Smile, Search, MoreVertical, Phone, Video, X, CheckCheck, Menu } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
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
  lastSeenAt: string | null
}

interface Chat {
  id: string
  chatId: string
  slug?: string
  status: string
  lastMessage?: Message | null
  visitor: Visitor
  agent?: {
    name: string
    email: string
  }
  _count: {
    messages: number
  }
  updatedAt: string
}

export default function AdminChat() {
  const navigate = useNavigate()
  const [chats, setChats] = useState<Chat[]>([])
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [_isConnected, _setIsConnected] = useState(false)
  const [_isInCall, _setIsInCall] = useState(false)
  const [_isCalling, _setIsCalling] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newMessageNotification, setNewMessageNotification] = useState<string | null>(null)
  const [unreadChats, setUnreadChats] = useState<Set<string>>(new Set())
  
  const socketRef = useRef<Socket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const localAudioRef = useRef<HTMLAudioElement>(null)
  const remoteAudioRef = useRef<HTMLAudioElement>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const selectedChatRef = useRef<Chat | null>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    selectedChatRef.current = selectedChat
  }, [selectedChat])

  useEffect(() => {
    const token = localStorage.getItem('adminToken')
    if (!token) return

    const socket = io(API_URL, {
      auth: { token }
    })

    socketRef.current = socket

    socket.on('connect', () => {
      console.log('Connected to chat server')
      _setIsConnected(true)
      
      if (selectedChatRef.current) {
        console.log('Rejoining chat after reconnect:', selectedChatRef.current.chatId)
        socket.emit('agent:join-chat', selectedChatRef.current.chatId)
      }
    })

    socket.on('disconnect', () => {
      console.log('Disconnected from chat server')
      _setIsConnected(false)
    })

    socket.on('connect_error', () => {
      _setIsConnected(false)
    })

    socket.on('message:new', (data: any) => {
      console.log('Admin received message:new:', data)
      const incoming = data.message
      const isFromVisitor = incoming.senderType === 'visitor'
      
      if (selectedChatRef.current && data.chatId === selectedChatRef.current.chatId) {
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
          if (latest && isFromVisitor && latest.id === incoming.id) {
            setNewMessageNotification(incoming.content)
          } else if (latest && !isFromVisitor && latest.id === incoming.id) {
            setNewMessageNotification(null)
          }
          return sorted
        })
        setUnreadChats(prev => {
          const next = new Set(prev)
          next.delete(data.chatId)
          return next
        })
      } else {
        if (isFromVisitor) {
          setNewMessageNotification(incoming.content)
          setUnreadChats(prev => new Set(prev).add(data.chatId))
        }
        console.log('Message ignored - no selected chat or chatId mismatch:', { 
          selectedChatId: selectedChatRef.current?.chatId, 
          messageChatId: data.chatId 
        })
      }
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
      
      _setIsInCall(true)
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
      _endCall()
    })

    return () => {
      socket.disconnect()
      _setIsConnected(false)
    }
  }, [])

  useEffect(() => {
    console.log('AdminChat mounted, fetching chats...')
    fetchChats()
  }, [])

  const fetchChats = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const token = localStorage.getItem('adminToken')
      
      if (!token) {
        navigate('/login')
        return
      }
      
      const res = await fetch(`${API_URL}/api/admin/chats`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem('adminToken')
          localStorage.removeItem('adminUser')
          navigate('/login')
          return
        }
        throw new Error(`HTTP ${res.status}`)
      }
      
      const data = await res.json()
      setChats(data)
      console.log('Chats fetched:', data.length)
    } catch (error) {
      console.error('Failed to fetch chats:', error)
      setError('Failed to load chats. Please try again.')
      setChats([])
    } finally {
      setIsLoading(false)
    }
  }

  const selectChat = async (chat: Chat) => {
    setSelectedChat(chat)
    setSidebarOpen(false)
    setNewMessageNotification(null)
    setUnreadChats(prev => {
      const next = new Set(prev)
      next.delete(chat.chatId)
      return next
    })
    
    try {
      const token = localStorage.getItem('adminToken')
      const res = await fetch(`${API_URL}/api/messages/chat/${chat.chatId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const data = await res.json()
      setMessages(data.messages && data.messages.length > 0 ? data.messages : getDemoMessages())
      
      if (socketRef.current?.connected) {
        socketRef.current.emit('agent:join-chat', chat.chatId)
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error)
    }
  }

  const sendMessage = async () => {
    console.log('sendMessage called:', { 
      hasInput: !!inputMessage.trim(), 
      hasSelectedChat: !!selectedChat, 
      socketConnected: socketRef.current?.connected 
    })
    
    if (!inputMessage.trim() || !selectedChat || !socketRef.current?.connected) {
      console.log('sendMessage early return - conditions not met')
      return
    }

    const content = inputMessage.trim()
    const tempId = `temp-${Date.now()}`
    
    const optimisticMessage: Message = {
      id: tempId,
      content,
      messageType: 'text',
      senderType: 'agent',
      isRead: false,
      isDelivered: true,
      createdAt: new Date().toISOString()
    }

    setMessages(prev => [...prev, optimisticMessage])
    setInputMessage('')
    setNewMessageNotification(null)
    scrollToBottom()

    try {
      console.log('Emitting agent:send-message:', { chatId: selectedChat.chatId, content })
      socketRef.current.emit('agent:send-message', {
        chatId: selectedChat.chatId,
        content,
        messageType: 'text'
      })
      console.log('agent:send-message emitted successfully')
    } catch (error) {
      console.error('Failed to send message:', error)
      setMessages(prev => prev.filter(msg => msg.id !== tempId))
    }
  }

  const handleFileUpload = async (file: File) => {
    if (!selectedChat) return

    const tempId = `temp-${Date.now()}`
    const messageType = getMessageTypeFromFile(file)

    const optimisticMessage: Message = {
      id: tempId,
      content: 'Uploading...',
      messageType: messageType || 'image',
      senderType: 'agent',
      isRead: false,
      isDelivered: true,
      createdAt: new Date().toISOString()
    }

    setMessages(prev => [...prev, optimisticMessage])
    scrollToBottom()

    try {
      const token = localStorage.getItem('adminToken')
      const formData = new FormData()
      formData.append('file', file)
      formData.append('chatId', selectedChat.chatId)

      const res = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })
      const data = await res.json()
      
      if (data.url) {
        const fullUrl = data.url.startsWith('http') ? data.url : `${API_URL}${data.url}`
        setMessages(prev => prev.map(msg => 
          msg.id === tempId 
            ? { ...msg, content: fullUrl, messageType: data.messageType }
            : msg
        ))
        
        socketRef.current?.emit('agent:send-message', {
          chatId: selectedChat.chatId,
          content: fullUrl,
          messageType: data.messageType
        })
      } else {
        setMessages(prev => prev.filter(msg => msg.id !== tempId))
      }
    } catch (error) {
      console.error('Failed to upload file:', error)
      setMessages(prev => prev.filter(msg => msg.id !== tempId))
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

  const _endCall = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }
    
    _setIsInCall(false)
    _setIsCalling(false)
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
          chatId: selectedChat?.chatId,
          candidate: event.candidate
        })
      }
    }
    
    peerConnectionRef.current = pc
    return pc
  }

  const getContactName = (chat: Chat) => {
    return chat.visitor.name || 'Anonymous'
  }

  const getContactSubtitle = (chat: Chat) => {
    if (chat.visitor.isOnline) return 'Online'
    if (chat.visitor.lastSeenAt) {
      const date = new Date(chat.visitor.lastSeenAt)
      return `Last seen ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    }
    return 'Offline'
  }

  const getLastMessage = (chat: Chat) => {
    if (chat.lastMessage) {
      const msg = chat.lastMessage
      const prefix = msg.senderType === 'agent' ? 'You: ' : ''
      const content = msg.messageType === 'text' ? msg.content : '📎 Media'
      return prefix + content
    }
    return 'No messages yet'
  }

  const getDemoMessages = (): Message[] => {
    const now = new Date()
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000)
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    
    return [
      {
        id: 'admin-demo-1',
        content: 'Hello! 👋 Welcome to our live chat. How can I help you today?',
        messageType: 'text',
        senderType: 'agent',
        isRead: true,
        isDelivered: true,
        createdAt: oneHourAgo.toISOString()
      },
      {
        id: 'admin-demo-2',
        content: 'Hi! I\'m interested in learning more about your services.',
        messageType: 'text',
        senderType: 'visitor',
        isRead: true,
        isDelivered: true,
        createdAt: oneHourAgo.toISOString()
      },
      {
        id: 'admin-demo-3',
        content: 'Great! I\'d be happy to help. What specific information are you looking for?',
        messageType: 'text',
        senderType: 'agent',
        isRead: true,
        isDelivered: true,
        createdAt: tenMinutesAgo.toISOString()
      },
      {
        id: 'admin-demo-4',
        content: 'Can you tell me about your pricing plans and features?',
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

  const filteredChats = chats
    .filter(chat => {
      const searchLower = searchQuery.toLowerCase()
      return (
        chat.visitor.name?.toLowerCase().includes(searchLower) ||
        chat.visitor.email?.toLowerCase().includes(searchLower) ||
        chat.visitor.mobile?.toLowerCase().includes(searchLower) ||
        chat.visitor.visitorId.toLowerCase().includes(searchLower)
      )
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading chats...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-white text-2xl">⚠️</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Error Loading Chats</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={fetchChats}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all duration-200"
            >
              Retry
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex">
          <div className={`${sidebarOpen ? 'w-80' : 'w-0'} bg-white border-r border-gray-200 flex flex-col transition-all duration-300 overflow-hidden`}>
            <div className="p-4 bg-green-700 text-white">
              <div className="flex items-center justify-between mb-3">
                <h1 className="text-xl font-bold">💬 Live Chat</h1>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-1 hover:bg-green-600 rounded-lg transition-all duration-200 hover:scale-110 lg:hidden"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-green-200 w-4 h-4" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search chats..."
                  className="w-full pl-10 pr-4 py-2 rounded-lg bg-green-600 text-white placeholder-green-200 focus:ring-2 focus:ring-white focus:border-transparent outline-none text-sm transition-all duration-200"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {filteredChats.map((chat) => {
                const isUnread = unreadChats.has(chat.chatId)
                return (
                  <div
                    key={chat.id}
                    onClick={() => selectChat(chat)}
                    className={`p-3 border-b border-gray-100 cursor-pointer transition-all duration-200 hover:bg-gray-50 ${
                      selectedChat?.id === chat.id ? 'bg-green-50' : ''
                    } ${isUnread ? 'bg-blue-50' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                          {getContactName(chat).charAt(0).toUpperCase()}
                        </div>
                        {chat.visitor.isOnline && (
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900 truncate">{getContactName(chat)}</h3>
                            {isUnread && (
                              <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                                New
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-gray-500">
                            {chat.updatedAt && formatTime(chat.updatedAt)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 truncate">{getLastMessage(chat)}</p>
                        {chat.visitor.mobile && (
                          <p className="text-xs text-gray-500">📱 {chat.visitor.mobile}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              {filteredChats.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  No chats found
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col bg-gray-50">
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
            
            {selectedChat ? (
              <>
                <div className="bg-white border-b border-gray-200 p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setSidebarOpen(true)
                        setSelectedChat(null)
                      }}
                      className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200 hover:scale-110"
                      title="Back to chats"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setSidebarOpen(!sidebarOpen)}
                      className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200 hover:scale-110 lg:hidden"
                    >
                      <Menu className="w-5 h-5 text-gray-600" />
                    </button>
                    <div className="relative">
                      <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center text-white font-semibold">
                        {getContactName(selectedChat).charAt(0).toUpperCase()}
                      </div>
                      {selectedChat.visitor.isOnline && (
                        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{getContactName(selectedChat)}</h3>
                      <p className="text-xs text-gray-500">
                        {selectedChat.visitor.mobile || selectedChat.visitor.email || 'No contact info'}
                      </p>
                      <p className="text-xs text-gray-500">{getContactSubtitle(selectedChat)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200 hover:scale-110">
                      <Phone className="w-5 h-5 text-gray-600" />
                    </button>
                    <button className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200 hover:scale-110">
                      <Video className="w-5 h-5 text-gray-600" />
                    </button>
                    <button className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200 hover:scale-110">
                      <MoreVertical className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                  {messages.length === 0 && (
                    <div className="text-center py-12 animate-fade-in">
                      <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse-soft">
                        <span className="text-white text-2xl">💬</span>
                      </div>
                      <h3 className="text-xl font-semibold text-gray-800 mb-2">{getContactName(selectedChat)}</h3>
                      <p className="text-gray-600">Start a conversation</p>
                    </div>
                  )}
                  
                    {messages.map((message, index) => {
                      const previousMessage = index > 0 ? messages[index - 1] : null
                      const showDateSeparator = shouldShowDateSeparator(message, previousMessage)
                      const isAgent = message.senderType === 'agent'
                      
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
                            className={`flex ${isAgent ? 'justify-end' : 'justify-start'} mb-2`}
                          >
                            <div
                              className={`max-w-[70%] px-4 py-2 rounded-lg shadow-sm ${
                                isAgent
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
                              <div className={`flex items-center gap-1 mt-1 text-xs ${isAgent ? 'text-green-100' : 'text-gray-500'}`}>
                                <span>{formatTime(message.createdAt)}</span>
                                {isAgent && (
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

                <div className="bg-white p-3 flex items-center gap-2 border-t border-gray-200">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*,audio/*"
                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200 hover:scale-110"
                  >
                    <Paperclip className="w-5 h-5 text-gray-600" />
                  </button>
                  
                  <button
                    onClick={() => setShowEmoji(!showEmoji)}
                    className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200 hover:scale-110"
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
                      className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200 hover:scale-110"
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
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center animate-fade-in">
                  <div className="w-24 h-24 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse-soft">
                    <span className="text-white text-4xl">💬</span>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">Live Chat Admin</h2>
                  <p className="text-gray-600">Select a chat to start messaging</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
