import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  role: string
  restaurant_id: string | null
}

interface AuthState {
  user: User | null
  access_token: string | null
  refresh_token: string | null
  setAuth: (user: User, access_token: string, refresh_token: string) => void
  logout: () => void
  isAuthenticated: () => boolean
  hasRole: (...roles: string[]) => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      access_token: null,
      refresh_token: null,

      setAuth: (user, access_token, refresh_token) => {
        localStorage.setItem('access_token', access_token)
        localStorage.setItem('refresh_token', refresh_token)
        set({ user, access_token, refresh_token })
      },

      logout: () => {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        set({ user: null, access_token: null, refresh_token: null })
      },

      isAuthenticated: () => !!get().access_token && !!get().user,

      hasRole: (...roles) => {
        const user = get().user
        return user ? roles.includes(user.role) : false
      },
    }),
    { name: 'auth-storage' },
  ),
)
