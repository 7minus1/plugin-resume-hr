import { useState, useEffect } from "react"
import "../style.css"
import { login, register, getUserProfile, logout, getBitableInfo, updateBitableInfo, getUserVipStatus, getUserUploadQuota } from "../services/authService"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../components/ui/form"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Toast } from "../components/ui/toast"

const formSchema = z.object({
  phoneNumber: z.string().regex(/^1[3-9]\d{9}$/, "请输入有效的手机号码"),
  password: z.string().min(8, "密码至少需要8个字符"),
  username: z.string().optional(),
  confirmPassword: z.string().optional(),
}).refine((data) => {
  if (data.confirmPassword) {
    return data.password === data.confirmPassword
  }
  return true
}, {
  message: "两次输入的密码不一致",
  path: ["confirmPassword"],
})

const HomePage = () => {
  const [isLoginOpen, setIsLoginOpen] = useState(false)
  const [isRegisterOpen, setIsRegisterOpen] = useState(false)
  const [user, setUser] = useState(null)
  const [passwordError, setPasswordError] = useState('')
  const [bitableInfo, setBitableInfo] = useState({
    bitableUrl: '',
    bitableToken: ''
  })
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [tempBitableInfo, setTempBitableInfo] = useState({
    bitableUrl: '',
    bitableToken: ''
  })
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null)
  const [vipStatus, setVipStatus] = useState<{
    isVip: boolean;
    vipExpireDate?: string;
    vipLevel?: number;
  } | null>(null)
  const [uploadQuota, setUploadQuota] = useState<{
    uploadCount: number;
    remainingCount: number;
    isUnlimited: boolean;
  } | null>(null)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      phoneNumber: "",
      password: "",
      username: "",
      confirmPassword: "",
    },
  })

  useEffect(() => {
    checkAuthStatus()
  }, [])

  useEffect(() => {
    if (user) {
      loadBitableInfo()
      loadUserVipStatus()
      loadUserUploadQuota()
    }
  }, [user])

  const checkAuthStatus = async () => {
    try {
      const result = await chrome.storage.local.get(['access_token', 'user'])
      const token = result.access_token
      const userStr = result.user
      
      if (token && userStr) {
        try {
          const userData = JSON.parse(userStr)
          setUser(userData)
        } catch (error) {
          console.error('解析用户数据失败:', error)
          await chrome.storage.local.remove(['access_token', 'user'])
          setUser(null)
        }
      } else {
        setUser(null)
      }
    } catch (error) {
      console.error('获取用户信息失败:', error)
      await chrome.storage.local.remove(['access_token', 'user'])
      setUser(null)
    }
  }

  const handleLogin = async (values: z.infer<typeof formSchema>) => {
    try {
      const response = await login({
        phoneNumber: values.phoneNumber,
        password: values.password
      })
      setIsLoginOpen(false)
      setUser(response.user)
      form.reset()
      setToast({ message: "登录成功", type: "success" })
    } catch (error) {
      console.error('登录失败:', error)
      setToast({ message: "登录失败，请检查手机号和密码", type: "error" })
    }
  }

  const handleRegister = async (values: z.infer<typeof formSchema>) => {
    try {
      await register({
        phoneNumber: values.phoneNumber,
        password: values.password,
        username: values.username || undefined
      })
      setIsRegisterOpen(false)
      setToast({ message: "注册成功，请登录", type: "success" })
      form.reset()
    } catch (error) {
      console.error('注册失败:', error)
      setToast({ message: "注册失败，请重试", type: "error" })
    }
  }

  const handleLogout = async () => {
    await logout()
    setUser(null)
  }

  const loadBitableInfo = async () => {
    try {
      const info = await getBitableInfo()
      if (info) {
        setBitableInfo({
          bitableUrl: info.bitableUrl,
          bitableToken: info.bitableToken
        })
        setTempBitableInfo({
          bitableUrl: info.bitableUrl,
          bitableToken: info.bitableToken
        })
      }
    } catch (error) {
      console.error('获取多维表格信息失败:', error)
    }
  }

  const handleEdit = () => {
    setIsEditing(true)
    setTempBitableInfo({ ...bitableInfo })
  }

  const handleCancel = () => {
    setIsEditing(false)
    setTempBitableInfo({ ...bitableInfo })
    setSaveStatus('')
  }

  const handleBitableSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setSaveStatus('')

    try {
      await updateBitableInfo(tempBitableInfo)
      setBitableInfo(tempBitableInfo)
      setSaveStatus('保存成功')
      setIsEditing(false)
    } catch (error) {
      console.error('更新多维表格信息失败:', error)
      setSaveStatus('保存失败，请重试')
    } finally {
      setIsSaving(false)
    }
  }

  const handleBitableChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setTempBitableInfo(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const loadUserVipStatus = async () => {
    try {
      const status = await getUserVipStatus()
      setVipStatus(status)
    } catch (error) {
      console.error('获取VIP状态失败:', error)
    }
  }

  const loadUserUploadQuota = async () => {
    try {
      console.log('开始加载上传配额信息...');
      const quota = await getUserUploadQuota();
      console.log('获取到的上传配额信息:', quota);
      setUploadQuota(quota);
    } catch (error) {
      console.error('获取上传配额失败:', error);
    }
  }

  return (
    <div className="plasmo-min-h-screen plasmo-bg-[#f5f7fa] plasmo-font-sans">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      <div className="plasmo-p-6 plasmo-flex plasmo-flex-col">
        <header className="plasmo-flex plasmo-items-center plasmo-mb-6">
          <h1 className="plasmo-text-2xl plasmo-font-medium plasmo-text-[#333] plasmo-m-0">
            推鲤 AI 快聘: HR筛选简历的好助手
          </h1>
          
          <div className="plasmo-ml-auto plasmo-flex plasmo-items-center plasmo-gap-3">
            {user ? (
              <>
                <div className="plasmo-flex plasmo-flex-col plasmo-items-end plasmo-mr-2">
                  <span className="plasmo-text-[#4b5563] plasmo-text-sm">
                    欢迎，{user.username || user.phoneNumber}
                  </span>
                  {vipStatus && (
                    <span className={`plasmo-text-xs ${vipStatus.isVip ? 'plasmo-text-[#ff4500]' : 'plasmo-text-gray-500'}`}>
                      {vipStatus.isVip ? `VIP会员 (${vipStatus.vipLevel || '标准'}级)` : '普通用户'}
                    </span>
                  )}
                  {/* {uploadQuota && (
                    <span className="plasmo-text-xs plasmo-text-gray-500">
                      剩余上传次数: {uploadQuota.remainingCount} 次
                    </span>
                  )} */}
                </div>
                <Button variant="outline" onClick={handleLogout}>
                  登出
                </Button>
              </>
            ) : (
              <>
                <Dialog open={isLoginOpen} onOpenChange={setIsLoginOpen}>
                  <DialogTrigger asChild>
                    <Button variant="default" className="plasmo-bg-[#ff4500] hover:plasmo-bg-[#e63e00] plasmo-text-white">登录</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>用户登录</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(handleLogin)} className="plasmo-space-y-4">
                        <FormField
                          control={form.control}
                          name="phoneNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>手机号</FormLabel>
                              <FormControl>
                                <Input type="tel" {...field} placeholder="请输入手机号" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>密码</FormLabel>
                              <FormControl>
                                <Input type="password" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button type="submit" className="plasmo-w-full plasmo-bg-[#ff4500] hover:plasmo-bg-[#e63e00] plasmo-text-white">登录</Button>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>

                <Dialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen}>
                  <DialogTrigger asChild>
                    <Button variant="default" className="plasmo-bg-[#ff4500] hover:plasmo-bg-[#e63e00] plasmo-text-white">注册</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>用户注册</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(handleRegister)} className="plasmo-space-y-4">
                        <FormField
                          control={form.control}
                          name="phoneNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>手机号 <span className="plasmo-text-[#ff4500]">*</span></FormLabel>
                              <FormControl>
                                <Input type="tel" {...field} placeholder="请输入手机号" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="username"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                用户名 <span className="plasmo-text-gray-500 plasmo-text-xs">(可选)</span>
                              </FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="请输入用户名（选填）" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>密码 <span className="plasmo-text-[#ff4500]">*</span></FormLabel>
                              <FormControl>
                                <Input type="password" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="confirmPassword"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>确认密码 <span className="plasmo-text-[#ff4500]">*</span></FormLabel>
                              <FormControl>
                                <Input type="password" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button type="submit" className="plasmo-w-full plasmo-bg-[#ff4500] hover:plasmo-bg-[#e63e00] plasmo-text-white">注册</Button>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </div>
        </header>

        <div className="plasmo-grid plasmo-grid-cols-1 md:plasmo-grid-cols-[2fr,1fr] plasmo-gap-6 plasmo-flex-1">
          {/* 左侧面板 */}
          <div className="plasmo-bg-white plasmo-rounded-lg plasmo-p-6 plasmo-shadow-sm">
            <div className="plasmo-border-l-4 plasmo-border-[#ff4500] plasmo-pl-3 plasmo-mb-5">
              <h2 className="plasmo-text-lg plasmo-font-medium plasmo-text-[#333] plasmo-m-0">简历解析</h2>
            </div>

            {user ? (
              <>
                {/* 添加上传配额信息 - 移除条件渲染，确保始终显示 */}
                <div className="plasmo-mb-4 plasmo-p-3 plasmo-bg-gray-50 plasmo-rounded-md plasmo-border plasmo-border-gray-200">
                  <div className="plasmo-flex plasmo-items-center plasmo-justify-between">
                    <span className="plasmo-text-sm plasmo-text-gray-600">剩余上传次数</span>
                    <span className="plasmo-font-medium plasmo-text-[#ff4500]">
                      {uploadQuota ? (uploadQuota.isUnlimited ? '无限制' : `${uploadQuota.remainingCount} 次`) : '加载中...'}
                    </span>
                  </div>
                  {uploadQuota && !uploadQuota.isUnlimited && (
                    <>
                      <div className="plasmo-mt-2">
                        <div className="plasmo-w-full plasmo-bg-gray-200 plasmo-rounded-full plasmo-h-2">
                          <div 
                            className="plasmo-bg-[#ff4500] plasmo-h-2 plasmo-rounded-full" 
                            style={{ width: `${(uploadQuota.remainingCount / (uploadQuota.uploadCount + uploadQuota.remainingCount)) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                      {uploadQuota.remainingCount < 5 && (
                        <div className="plasmo-mt-2 plasmo-text-xs plasmo-text-[#ff4500]">
                          上传次数不足，请购买更多次数
                        </div>
                      )}
                    </>
                  )}
                </div>

                <form onSubmit={handleBitableSubmit} className="plasmo-mt-5 plasmo-p-4 plasmo-border plasmo-border-gray-200 plasmo-rounded-lg plasmo-bg-gray-50">
                  <div className="plasmo-flex plasmo-justify-between plasmo-items-center plasmo-mb-4">
                    <h3 className="plasmo-text-base plasmo-font-medium plasmo-text-[#333] plasmo-m-0">多维表格配置</h3>
                    {!isEditing && (
                      <Button
                        variant="outline"
                        onClick={handleEdit}
                        className="plasmo-text-[#ff4500] plasmo-border-[#ff4500] hover:plasmo-bg-[#fff5f2]"
                      >
                        编辑
                      </Button>
                    )}
                  </div>

                  {isEditing ? (
                    <>
                      <Input
                        type="url"
                        name="bitableUrl"
                        value={tempBitableInfo.bitableUrl}
                        onChange={handleBitableChange}
                        placeholder="请输入多维表格链接"
                        className="plasmo-mb-3"
                        required
                      />
                      <Input
                        type="text"
                        name="bitableToken"
                        value={tempBitableInfo.bitableToken}
                        onChange={handleBitableChange}
                        placeholder="请输入多维表格授权码"
                        className="plasmo-mb-3"
                        required
                      />
                      <div className="plasmo-flex plasmo-gap-2">
                        <Button
                          type="submit"
                          disabled={isSaving}
                          className="plasmo-flex-1"
                        >
                          {isSaving ? '保存中...' : '保存'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleCancel}
                          className="plasmo-flex-1"
                        >
                          取消
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="plasmo-mb-3">
                        <div className="plasmo-text-xs plasmo-text-gray-500 plasmo-mb-1">多维表格链接</div>
                        <div className="plasmo-text-sm plasmo-text-gray-900 plasmo-break-all">
                          {bitableInfo.bitableUrl || '未设置'}
                        </div>
                      </div>
                      <div className="plasmo-mb-3">
                        <div className="plasmo-text-xs plasmo-text-gray-500 plasmo-mb-1">多维表格授权码</div>
                        <div className="plasmo-text-sm plasmo-text-gray-900">
                          {bitableInfo.bitableToken ? '••••••••' : '未设置'}
                        </div>
                      </div>
                    </>
                  )}

                  {saveStatus && (
                    <p className={`plasmo-mt-2 plasmo-text-sm plasmo-text-center ${
                      saveStatus.includes('成功') ? 'plasmo-text-green-600' : 'plasmo-text-red-600'
                    }`}>
                      {saveStatus}
                    </p>
                  )}
                </form>
              </>
            ) : (
              <div className="plasmo-bg-gray-100 plasmo-p-4 plasmo-rounded-lg plasmo-mb-4">
                <p className="plasmo-text-gray-600 plasmo-m-0">请先登录以配置多维表格</p>
              </div>
            )}
          </div>

          {/* 右侧面板 */}
          <div className="plasmo-flex plasmo-flex-col plasmo-gap-6">
            {/* 会员卡片 */}
            <div className="plasmo-bg-[#fff5f2] plasmo-rounded-lg plasmo-p-6 plasmo-relative plasmo-overflow-hidden">
              {vipStatus && vipStatus.isVip ? (
                <>
                  <div className="plasmo-inline-block plasmo-px-3 plasmo-py-1 plasmo-bg-[#ff4500] plasmo-text-white plasmo-rounded plasmo-text-sm plasmo-mb-4">
                    VIP会员
                  </div>

                  <div className="plasmo-text-3xl plasmo-font-bold plasmo-text-[#333] plasmo-mb-6">
                    {vipStatus.vipLevel ? `${vipStatus.vipLevel}级会员` : '标准会员'}
                  </div>

                  {vipStatus.vipExpireDate && (
                    <div className="plasmo-mb-4 plasmo-text-sm plasmo-text-gray-600">
                      到期时间: {new Date(vipStatus.vipExpireDate).toLocaleDateString()}
                    </div>
                  )}

                  <ul className="plasmo-list-none plasmo-p-0 plasmo-m-0 plasmo-mb-6">
                    {[
                      "智能解析简历关键信息",
                      "同步飞书多维度管理",
                      "AI评估推荐优质候选人"
                    ].map((feature, index) => (
                      <li key={index} className="plasmo-flex plasmo-items-center plasmo-mb-2 plasmo-text-gray-600 plasmo-text-sm">
                        <span className="plasmo-w-1.5 plasmo-h-1.5 plasmo-bg-[#ff4500] plasmo-rounded-full plasmo-mr-2"></span>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Button className="plasmo-w-full plasmo-bg-[#ff4500] hover:plasmo-bg-[#e63e00] plasmo-text-white">
                    续费会员
                  </Button>
                </>
              ) : (
                <>
                  <div className="plasmo-inline-block plasmo-px-3 plasmo-py-1 plasmo-bg-[#ff4500] plasmo-text-white plasmo-rounded plasmo-text-sm plasmo-mb-4">
                    高级标准版
                  </div>

                  <div className="plasmo-text-3xl plasmo-font-bold plasmo-text-[#333] plasmo-mb-6">
                    ¥99.00 <span className="plasmo-text-sm plasmo-font-normal">/人/年</span>
                  </div>

                  <ul className="plasmo-list-none plasmo-p-0 plasmo-m-0 plasmo-mb-6">
                    {[
                      "智能解析简历关键信息",
                      "同步飞书多维度管理",
                      "AI评估推荐优质候选人"
                    ].map((feature, index) => (
                      <li key={index} className="plasmo-flex plasmo-items-center plasmo-mb-2 plasmo-text-gray-600 plasmo-text-sm">
                        <span className="plasmo-w-1.5 plasmo-h-1.5 plasmo-bg-[#ff4500] plasmo-rounded-full plasmo-mr-2"></span>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Button className="plasmo-w-full plasmo-bg-[#ff4500] hover:plasmo-bg-[#e63e00] plasmo-text-white">
                    立即购买
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HomePage 