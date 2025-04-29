import { useState, useEffect } from "react"
import "../style.css"
import { verifyCode, getUserProfile, logout, getBitableInfo, updateBitableInfo, getUserVipStatus, getUserUploadQuota, sendVerificationCode } from "../services/authService"
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
  DialogDescription,
  DialogFooter,
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

// 更新表单验证规则
const formSchema = z.object({
  phoneNumber: z.string().regex(/^1[3-9]\d{9}$/, "请输入有效的手机号码"),
  code: z.string().min(4, "请输入有效的验证码").max(6, "请输入有效的验证码"),
})

const HomePage = () => {
  const [isLoginOpen, setIsLoginOpen] = useState(false)
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
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
  const [isSendingCode, setIsSendingCode] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [isBitableConfigured, setIsBitableConfigured] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      phoneNumber: "",
      code: "",
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

  // 添加倒计时逻辑
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  // 添加自动关闭Toast的逻辑
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  // 添加表单开启关闭的处理
  useEffect(() => {
    if (isLoginOpen) {
      // 当对话框打开时重置表单
      form.reset({
        phoneNumber: "",
        code: ""
      })
    }
  }, [isLoginOpen, form])

  const checkAuthStatus = async () => {
    try {
      console.log('开始检查认证状态...');
      const result = await chrome.storage.local.get(['access_token', 'user']);
      console.log('从Chrome存储获取的数据:', result);
      
      const token = result.access_token;
      const userStr = result.user;
      
      if (token && userStr) {
        console.log('找到token和用户数据');
        try {
          const userData = JSON.parse(userStr);
          console.log('从存储中加载的用户数据:', userData);
          setUser(userData);
          // 确保加载用户相关数据
          loadBitableInfo();
          loadUserVipStatus();
          loadUserUploadQuota();
        } catch (error) {
          console.error('解析用户数据失败:', error);
          await chrome.storage.local.remove(['access_token', 'user']);
          setUser(null);
        }
      } else {
        console.log('未找到token或用户数据');
        setUser(null);
      }
    } catch (error) {
      console.error('获取用户信息失败:', error);
      await chrome.storage.local.remove(['access_token', 'user']);
      setUser(null);
    }
  }

  const handleSendVerificationCode = async () => {
    const phoneNumber = form.getValues('phoneNumber')
    const phoneNumberValid = /^1[3-9]\d{9}$/.test(phoneNumber)
    
    if (!phoneNumberValid) {
      form.setError('phoneNumber', { 
        type: 'manual', 
        message: '请输入有效的手机号码'
      })
      return
    }
    
    try {
      setIsSendingCode(true)
      await sendVerificationCode(phoneNumber)
      setToast({ message: "验证码已发送", type: "success" })
      // 设置60秒倒计时
      setCountdown(60)
    } catch (error: any) {
      const errorMessage = error.message || "发送验证码失败，请重试"
      setToast({ message: errorMessage, type: "error" })
    } finally {
      setIsSendingCode(false)
    }
  }

  const handleVerifyCode = async (values: z.infer<typeof formSchema>) => {
    try {
      setIsLoading(true);
      console.log('开始验证码登录/注册...');
      const response = await verifyCode({
        phoneNumber: values.phoneNumber,
        code: values.code
      });
      console.log('验证码登录/注册成功，响应数据:', response);
      
      setIsLoginOpen(false);
      setUser(response.user);
      console.log('已设置用户状态:', response.user);
      
      // 添加延迟，确保token已保存到Chrome存储
      console.log('等待token保存完成...');
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // 验证token是否已保存
      const tokenCheck = await chrome.storage.local.get(['access_token']);
      console.log('验证token是否已保存:', tokenCheck);
      
      if (!tokenCheck.access_token) {
        console.error('token未保存成功，尝试重新保存');
        await chrome.storage.local.set({ access_token: response.access_token });
        // 再次等待
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // 立即加载用户相关数据
      console.log('开始加载用户相关数据...');
      loadBitableInfo();
      loadUserVipStatus();
      loadUserUploadQuota();
      
      form.reset();
      setToast({ message: "登录成功", type: "success" });
    } catch (error: any) {
      console.error('验证码登录/注册失败:', error);
      const errorMessage = error.message || "验证码错误或已过期";
      setToast({ message: errorMessage, type: "error" });
    } finally {
      setIsLoading(false);
    }
  }

  const handleLogout = async () => {
    await logout()
    setUser(null)
  }

  const loadBitableInfo = async () => {
    try {
      const info = await getBitableInfo()
      console.log('获取到的多维表格信息:', info)
      
      if (info) {
        setIsBitableConfigured(info.configured)
        
        if (info.configured && info.data) {
          setBitableInfo({
            bitableUrl: info.data.bitableUrl,
            bitableToken: info.data.bitableToken
          })
          setTempBitableInfo({
            bitableUrl: info.data.bitableUrl,
            bitableToken: info.data.bitableToken
          })
        } else {
          // 未配置多维表格信息
          setBitableInfo({
            bitableUrl: '',
            bitableToken: ''
          })
          setTempBitableInfo({
            bitableUrl: '',
            bitableToken: ''
          })
        }
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
      // 使用toast显示成功消息
      setToast({ message: "保存成功", type: "success" })
      // 保存成功时退出编辑状态
      setIsEditing(false)
      // 重新加载多维表格信息
      loadBitableInfo()
    } catch (error) {
      console.error('更新多维表格信息失败:', error)
      // 使用toast显示失败消息
      setToast({ message: "多维表配置失败", type: "error" })
      // 失败时保持在编辑状态，不退出
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
        <div
          className="plasmo-fixed plasmo-top-5 plasmo-left-1/2 plasmo-transform plasmo--translate-x-1/2 plasmo-z-[10001] plasmo-px-6 plasmo-py-3 plasmo-rounded-lg plasmo-shadow-lg plasmo-transition-all plasmo-duration-300 plasmo-ease-in-out plasmo-min-w-[200px] plasmo-text-center"
          style={{
            backgroundColor: toast.type === 'success' ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 0, 0, 0.8)',
            color: 'white'
          }}>
          {toast.message}
        </div>
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
                    欢迎，{ user.phoneNumber }
                  </span>
                  {vipStatus && (
                    <span className={`plasmo-text-xs ${vipStatus.isVip ? 'plasmo-text-[#ff4500]' : 'plasmo-text-gray-500'}`}>
                      {vipStatus.isVip ? `VIP会员 (${vipStatus.vipLevel || '标准'}级)` : '普通用户'}
                    </span>
                  )}
                </div>
                <Button variant="outline" onClick={handleLogout}>
                  登出
                </Button>
              </>
            ) : (
              <>
                <Dialog open={isLoginOpen} onOpenChange={setIsLoginOpen}>
                  <DialogTrigger asChild>
                    <Button variant="default" className="plasmo-bg-[#ff4500] hover:plasmo-bg-[#e63e00] plasmo-text-white">登录/注册</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>登录/注册</DialogTitle>
                      <DialogDescription>
                        请输入手机号获取验证码登录或注册<br/>
                        未注册的手机号默认为您进行注册
                      </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(handleVerifyCode)} className="plasmo-space-y-4">
                        <FormField
                          control={form.control}
                          name="phoneNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>手机号</FormLabel>
                              <div className="plasmo-flex plasmo-space-x-2">
                                <FormControl>
                                  <Input type="tel" {...field} placeholder="请输入手机号" />
                                </FormControl>
                                <Button 
                                  type="button" 
                                  variant="outline" 
                                  className="plasmo-whitespace-nowrap"
                                  onClick={handleSendVerificationCode}
                                  disabled={isSendingCode || countdown > 0}
                                >
                                  {countdown > 0 ? `${countdown}秒后重试` : '发送验证码'}
                                </Button>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="code"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>验证码</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="请输入验证码" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button
                          type="submit"
                          className="plasmo-w-full plasmo-bg-[#ff4500] hover:plasmo-bg-[#e63e00] plasmo-text-white"
                          disabled={isLoading}>
                          {isLoading ? "验证中..." : "登录/注册"}
                        </Button>
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
                          {isBitableConfigured ? bitableInfo.bitableUrl : '未设置'}
                        </div>
                      </div>
                      <div className="plasmo-mb-3">
                        <div className="plasmo-text-xs plasmo-text-gray-500 plasmo-mb-1">多维表格授权码</div>
                        <div className="plasmo-text-sm plasmo-text-gray-900">
                          {isBitableConfigured ? '••••••••' : '未设置'}
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

                {/* 新增资源卡片 */}
                <div className="plasmo-mt-6 plasmo-p-4 plasmo-border plasmo-border-gray-200 plasmo-rounded-lg plasmo-bg-gray-50">
                  <h3 className="plasmo-text-base plasmo-font-medium plasmo-text-[#333] plasmo-mb-4">资源中心</h3>
                  <div className="plasmo-space-y-3">
                    <div>
                      <div className="plasmo-text-sm plasmo-font-medium plasmo-text-gray-700 plasmo-mb-1">手把手安装使用指南
                        <a 
                          href="https://liyuejiuxiao.feishu.cn/docx/XeZ0dTUdDoXxp9xAEdlcpcBCnTd?from=from_copylink" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="plasmo-text-sm plasmo-text-[#ff4500] hover:plasmo-text-[#e63e00] plasmo-inline-flex plasmo-items-center"
                        >
                          <span>&nbsp;立即查看</span>
                          <svg className="plasmo-w-4 plasmo-h-4 plasmo-ml-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M7 17L17 7M17 7H8M17 7V16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </a>
                      </div>
                    </div>
                    <div>
                      <div className="plasmo-text-sm plasmo-font-medium plasmo-text-gray-700 plasmo-mb-1">多维表格模板
                        <a 
                          href="https://ycnbmjmwp0hj.feishu.cn/base/EzNnbOeQxaQ2h0sPVbwcDcPunic?table=tbl6r8N8ixyd3XbL&view=vewzsLGvej" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="plasmo-text-sm plasmo-text-[#ff4500] hover:plasmo-text-[#e63e00] plasmo-inline-flex plasmo-items-center"
                        >
                          <span>&nbsp;立即查看</span>
                          <svg className="plasmo-w-4 plasmo-h-4 plasmo-ml-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M7 17L17 7M17 7H8M17 7V16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </a>
                      </div>
                    </div>
                    <div>
                      <div className="plasmo-text-sm plasmo-font-medium plasmo-text-gray-700 plasmo-mb-1">免费内测申请地址
                        <a 
                          href="https://ycnbmjmwp0hj.feishu.cn/share/base/form/shrcneX1NSH0RjjyoONo215U03d" 
                          target="_blank" 
                        rel="noopener noreferrer"
                        className="plasmo-text-sm plasmo-text-[#ff4500] hover:plasmo-text-[#e63e00] plasmo-inline-flex plasmo-items-center"
                        >
                          <span>&nbsp;立即申请</span>
                        <svg className="plasmo-w-4 plasmo-h-4 plasmo-ml-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M7 17L17 7M17 7H8M17 7V16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
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
                    ¥  ̶?̶?̶.̶?̶?̶ <span className="plasmo-text-sm plasmo-font-normal">/人/年</span>
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
                  
                  <Button 
                    className="plasmo-w-full plasmo-bg-[#ff4500] hover:plasmo-bg-[#e63e00] plasmo-text-white plasmo-opacity-50 plasmo-cursor-not-allowed"
                    disabled
                  >
                    限时免费内测中
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