/// <reference types="chrome"/>

import type { PlasmoCSConfig } from "plasmo"
import { config as envConfig } from '../config/env';

export const config: PlasmoCSConfig = {
  matches: ["https://lpt.liepin.com/chat/im*"],
  all_frames: true,
  run_at: "document_end"
}

console.log('Content script loaded')

// 等待目标容器加载
const waitForTargetContainer = (): Promise<HTMLElement> => {
  return new Promise((resolve) => {
    const checkContainer = () => {
      const container = document.querySelector('.ant-lpt-modal-body') as HTMLElement
      if (container) {
        console.log('找到目标容器')
        resolve(container)
      } else {
        console.log('目标容器未找到，等待100ms后重试')
        setTimeout(checkContainer, 100)
      }
    }
    checkContainer()
  })
}

// 创建浮窗UI
const createFloatingWindow = async () => {
  console.log('Creating floating window')
  const floatingWindow = document.createElement('div')
  floatingWindow.style.cssText = `
    position: absolute;
    bottom: 20px;
    right: 20px;
    background: white;
    padding: 15px;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    z-index: 9999;
    display: none;
    margin-right: 20px;
  `
  
  const title = document.createElement('div')
  title.textContent = '推鲤 AI 快聘'
  title.style.cssText = `
    font-size: 16px;
    font-weight: bold;
    margin-bottom: 10px;
  `
  
  const uploadButton = document.createElement('button')
  uploadButton.textContent = '简历入库'
  uploadButton.style.cssText = `
    background: #ff4500;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
  `
  
  const status = document.createElement('div')
  status.style.cssText = `
    margin-top: 10px;
    font-size: 14px;
    color: #666;
  `
  
  floatingWindow.appendChild(title)
  floatingWindow.appendChild(uploadButton)
  floatingWindow.appendChild(status)
  
  // 等待目标容器加载
  const targetContainer = await waitForTargetContainer()
  console.log('目标容器已加载:', targetContainer)
  
  if (targetContainer) {
    console.log('找到目标容器，添加浮窗')
    targetContainer.style.position = 'relative'
    targetContainer.appendChild(floatingWindow)
  } else {
    console.error('未找到目标容器，尝试添加到 body')
    floatingWindow.style.position = 'fixed'
    document.body.appendChild(floatingWindow)
  }
  
  console.log('浮窗创建完成，当前显示状态:', floatingWindow.style.display)
  
  return {
    window: floatingWindow,
    uploadButton,
    status
  }
}

// 处理PDF上传
const handlePdfUpload = async (pdfUrl: string, fileName: string, statusElement: HTMLElement) => {
  try {
    statusElement.textContent = '正在处理...'
    console.log('Starting PDF upload process...')
    
    // 获取PDF文件内容，使用与页面相同的请求头
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000) // 30秒超时

    console.log('Fetching PDF from:', pdfUrl)
    const pdfResponse = await fetch(pdfUrl, {
      credentials: 'include', // 包含cookies
      headers: {
        'Accept': 'application/pdf',
        'Referer': window.location.href
      },
      signal: controller.signal
    })
    
    clearTimeout(timeout)
    
    if (!pdfResponse.ok) {
      throw new Error('获取PDF失败')
    }
    
    const blob = await pdfResponse.blob()
    // 确保设置正确的MIME类型
    const file = new File([blob], fileName, { 
      type: 'application/pdf',
      lastModified: new Date().getTime()
    })
    console.log('PDF file created:', fileName, 'MIME type:', file.type)

    // 获取认证令牌
    const result = await chrome.storage.local.get(['access_token'])
    const token = result.access_token

    if (!token) {
      statusElement.textContent = '未登录，请先登录'
      return
    }

    statusElement.textContent = '正在上传...'
    console.log('准备发送请求，文件大小:', file.size, '文件名:', fileName)

    try {
      // 直接发送请求到服务器
      const formData = new FormData()
      formData.append('file', file)

      console.log('发送请求到服务器...')
      const response = await fetch(`${envConfig.API_BASE_URL}/resume/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })

      console.log('服务器响应状态:', response.status)
      const result = await response.json()
      console.log('服务器响应:', result)

      if (response.ok) {
        statusElement.textContent = '上传成功！'
        setTimeout(() => {
          statusElement.textContent = ''
        }, 3000)
      } else {
        throw new Error(result.message || '上传失败')
      }
    } catch (error) {
      console.error('上传请求失败:', error)
      statusElement.textContent = `错误：${error.message}`
    }
  } catch (error) {
    console.error('Error in handlePdfUpload:', error)
    if (error.name === 'AbortError') {
      statusElement.textContent = '请求超时，请重试'
    } else {
      statusElement.textContent = `错误：${error.message}`
    }
  }
}

// 检查并处理PDF链接
const checkAndHandlePdfLinks = (
  element: Element,
  currentPdfUrl: string | null,
  currentFileName: string | null,
  floatingWindow: HTMLElement,
  uploadButton: HTMLButtonElement,
  status: HTMLElement
) => {
  console.log('检查元素中的PDF链接:', element)
  const downloadLinks = element.querySelectorAll('a.download--SCDVl')
  console.log('找到下载链接数量:', downloadLinks.length)
  
  downloadLinks.forEach((link) => {
    if (link instanceof HTMLAnchorElement) {
      console.log('处理下载链接:', link.href)
      const pdfUrl = link.href
      const urlParams = new URLSearchParams(pdfUrl.split('?')[1])
      const encodedFileName = urlParams.get('dlFileName')
      const baseFileName = encodedFileName ? decodeURIComponent(encodedFileName) : 'resume'
      // 确保文件名以.pdf结尾
      const fileName = baseFileName.endsWith('.pdf') ? baseFileName : `${baseFileName}.pdf`
      
      currentPdfUrl = pdfUrl
      currentFileName = fileName
      floatingWindow.style.display = 'block'
      console.log('显示浮窗，当前URL:', currentPdfUrl, '文件名:', currentFileName)
      
      // 更新上传按钮点击事件
      uploadButton.onclick = async () => {
        if (currentPdfUrl && currentFileName) {
          await handlePdfUpload(currentPdfUrl, currentFileName, status)
        }
      }
    }
  })
}

// 监听页面变化，查找下载链接
const observePage = async () => {
  console.log('开始监听页面变化')
  const { window: floatingWindow, uploadButton, status } = await createFloatingWindow()
  let currentPdfUrl: string | null = null
  let currentFileName: string | null = null

  // 立即检查现有元素
  console.log('检查现有元素')
  checkAndHandlePdfLinks(document.body, currentPdfUrl, currentFileName, floatingWindow, uploadButton, status)

  const observer = new MutationObserver((mutations) => {
    console.log('DOM mutation detected')
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) {
          checkAndHandlePdfLinks(node, currentPdfUrl, currentFileName, floatingWindow, uploadButton, status)
        }
      })
    })
  })

  // 开始观察
  observer.observe(document.body, {
    childList: true,
    subtree: true
  })
  console.log('MutationObserver started')
}

// 确保DOM加载完成后执行
console.log('Current document readyState:', document.readyState)
if (document.readyState === 'loading') {
  console.log('Waiting for DOMContentLoaded')
  document.addEventListener('DOMContentLoaded', () => observePage())
} else {
  console.log('DOM already loaded, running observePage immediately')
  observePage()
} 