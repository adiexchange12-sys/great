import { Navigate } from 'react-router-dom'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireAdmin?: boolean
}

export default function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const token = localStorage.getItem('adminToken')
  const user = localStorage.getItem('adminUser')

  if (!token || !user) {
    return <Navigate to="/login" replace />
  }

  const userData = JSON.parse(user)
  
  if (requireAdmin && !['admin', 'super_admin'].includes(userData.role)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
