import React, { useState, useEffect } from 'react'
import { config } from '~config/env'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

const Home: React.FC = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loggedIn, setLoggedIn] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 检查登录状态
  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const result = await chrome.storage.local.get(['access_token'])
        setLoggedIn(!!result.access_token)
      } catch (error) {
        console.error('Error checking login status:', error)
      }
    }
    checkLoginStatus()
  }, [])

  // 创建提示框
  const createToast = (message: string, type: 'success' | 'error' = 'success') => {
    console.log('Creating toast:', message, type)
    const toast = document.createElement('div')
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: ${type === 'success' ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 0, 0, 0.8)'};
      color: white;
      padding: 12px 24px;
      border-radius: 4px;
      z-index: 10001;
      font-size: 14px;
      transition: opacity 0.3s ease;
      pointer-events: none;
      opacity: 1;
    `
    toast.textContent = message
    document.body.appendChild(toast)
    
    // 3秒后自动消失
    setTimeout(() => {
      toast.style.opacity = '0'
      setTimeout(() => {
        if (document.body.contains(toast)) {
          document.body.removeChild(toast)
        }
      }, 300)
    }, 3000)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setLoading(true)
      setError('')
      
      const response = await fetch(`${config.API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username,
          password
        })
      })

      const data = await response.json()
      console.log('Login response:', data)

      if (response.ok) {
        await chrome.storage.local.set({ access_token: data.access_token })
        setLoggedIn(true)
        setUsername('')
        setPassword('')
        createToast('登录成功！', 'success')
      } else {
        // 处理登录失败
        const errorMessage = data.message || '用户名或密码错误'
        console.log('Login failed:', errorMessage)
        setError(errorMessage)
        createToast(errorMessage, 'error')
        setPassword('')
      }
    } catch (error) {
      console.error('Login error:', error)
      let errorMessage = '登录失败，请稍后重试'
      
      // 处理fetch错误
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        errorMessage = '无法连接到服务器，请检查网络连接'
      } else if (error instanceof Error) {
        errorMessage = error.message
      }
      
      setError(errorMessage)
      createToast(errorMessage, 'error')
      setPassword('')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await chrome.storage.local.remove(['access_token'])
      setLoggedIn(false)
      createToast('已登出', 'success')
    } catch (error) {
      console.error('Logout error:', error)
      setError('登出失败，请稍后重试')
      createToast('登出失败，请稍后重试', 'error')
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 py-6 flex flex-col justify-center sm:py-12">
      <div className="relative py-3 sm:max-w-xl sm:mx-auto">
        <div className="relative px-4 py-10 bg-white mx-8 md:mx-0 shadow rounded-3xl sm:p-10">
          <div className="max-w-md mx-auto">
            <div className="divide-y divide-gray-200">
              <div className="py-8 text-base leading-6 space-y-4 text-gray-700 sm:text-lg sm:leading-7">
                {!loggedIn ? (
                  <Dialog>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle>登录</DialogTitle>
                        <DialogDescription>
                          请输入您的账号和密码进行登录
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleLogin}>
                        <div className="relative">
                          <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="peer h-10 w-full border-b-2 border-gray-300 text-gray-900 placeholder-transparent focus:outline-none focus:border-rose-600"
                            placeholder="用户名"
                            required
                          />
                          <label className="absolute left-0 -top-3.5 text-gray-600 text-sm peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-440 peer-placeholder-shown:top-2 transition-all peer-focus:-top-3.5 peer-focus:text-gray-600 peer-focus:text-sm">
                            用户名
                          </label>
                        </div>
                        <div className="relative">
                          <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="peer h-10 w-full border-b-2 border-gray-300 text-gray-900 placeholder-transparent focus:outline-none focus:border-rose-600"
                            placeholder="密码"
                            required
                          />
                          <label className="absolute left-0 -top-3.5 text-gray-600 text-sm peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-440 peer-placeholder-shown:top-2 transition-all peer-focus:-top-3.5 peer-focus:text-gray-600 peer-focus:text-sm">
                            密码
                          </label>
                        </div>
                        {error && (
                          <div className="text-red-500 text-sm mt-2">
                            {error}
                          </div>
                        )}
                        <div className="relative">
                          <button
                            type="submit"
                            disabled={loading}
                            className="bg-blue-500 text-white rounded-md px-4 py-2 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed w-full"
                          >
                            {loading ? '登录中...' : '登录'}
                          </button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                ) : (
                  <div className="text-center">
                    <p className="text-lg font-semibold mb-4">已登录</p>
                    <button
                      onClick={handleLogout}
                      className="bg-red-500 text-white rounded-md px-4 py-2 hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                    >
                      登出
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home 