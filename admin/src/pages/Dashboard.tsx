import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MessageSquare, Users, UserCheck, MessageCircle, LogOut } from 'lucide-react'

interface Stats {
  visitors: { total: number; active: number }
  chats: { total: number; open: number; closed: number }
  messages: { total: number }
  agents: { total: number; active: number }
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/admin/stats', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      })
      const data = await res.json()
      setStats(data)
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('adminToken')
    localStorage.removeItem('adminRefreshToken')
    localStorage.removeItem('adminUser')
    navigate('/login')
  }

  const StatCard = ({ title, value, icon, color }: { title: string; value: number; icon: React.ReactNode; color: string }) => (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-sm">{title}</p>
          <p className="text-2xl font-bold text-gray-800">{value}</p>
        </div>
        <div className={`p-3 rounded-full ${color}`}>
          {icon}
        </div>
      </div>
    </div>
  )

  if (!stats) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">Live Chat Admin</h1>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Visitors"
            value={stats.visitors.total}
            icon={<Users className="w-6 h-6 text-blue-600" />}
            color="bg-blue-100"
          />
          <StatCard
            title="Active Visitors"
            value={stats.visitors.active}
            icon={<UserCheck className="w-6 h-6 text-green-600" />}
            color="bg-green-100"
          />
          <StatCard
            title="Total Chats"
            value={stats.chats.total}
            icon={<MessageSquare className="w-6 h-6 text-purple-600" />}
            color="bg-purple-100"
          />
          <StatCard
            title="Total Messages"
            value={stats.messages.total}
            icon={<MessageCircle className="w-6 h-6 text-orange-600" />}
            color="bg-orange-100"
          />
        </div>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Chat Status</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Open Chats</span>
                <span className="text-2xl font-bold text-green-600">{stats.chats.open}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full"
                  style={{ width: `${stats.chats.total > 0 ? (stats.chats.open / stats.chats.total) * 100 : 0}%` }}
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Closed Chats</span>
                <span className="text-2xl font-bold text-gray-600">{stats.chats.closed}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Agent Status</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Active Agents</span>
                <span className="text-2xl font-bold text-blue-600">{stats.agents.active}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${stats.agents.total > 0 ? (stats.agents.active / stats.agents.total) * 100 : 0}%` }}
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Agents</span>
                <span className="text-2xl font-bold text-gray-600">{stats.agents.total}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex gap-4">
          <Link
            to="/"
            className="flex-1 bg-white rounded-lg shadow p-6 hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer"
          >
            <h3 className="text-lg font-semibold mb-2">💬 All Chats</h3>
            <p className="text-gray-600">Chat with all visitors</p>
          </Link>
          <Link
            to="/chat-rooms"
            className="flex-1 bg-white rounded-lg shadow p-6 hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer"
          >
            <h3 className="text-lg font-semibold mb-2">Chat Rooms</h3>
            <p className="text-gray-600">Create and manage chat rooms with links</p>
          </Link>
          <Link
            to="/visitors"
            className="flex-1 bg-white rounded-lg shadow p-6 hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer"
          >
            <h3 className="text-lg font-semibold mb-2">View Visitors</h3>
            <p className="text-gray-600">Monitor visitor activity</p>
          </Link>
          <Link
            to="/agents"
            className="flex-1 bg-white rounded-lg shadow p-6 hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer"
          >
            <h3 className="text-lg font-semibold mb-2">Manage Agents</h3>
            <p className="text-gray-600">Add and manage support agents</p>
          </Link>
        </div>
      </div>
    </div>
  )
}
