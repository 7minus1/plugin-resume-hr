/// <reference types="chrome"/>

import type { PlasmoCSConfig } from "plasmo"
import { config as envConfig } from '../config/env';

// 直接定义配置，避免导入
const API_BASE_URL = envConfig.API_BASE_URL

export const config: PlasmoCSConfig = {
  matches: ["https://exmail.qq.com/*"],
  all_frames: true,
  run_at: "document_end"
}

console.log('QQ Mail PDF content script loaded')

// 创建提示框
const createToast = (message: string) => {
  const toast = document.createElement('div')
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 12px 24px;
    border-radius: 4px;
    z-index: 10001;
    font-size: 14px;
    transition: opacity 0.3s ease;
  `
  toast.textContent = message
  document.body.appendChild(toast)
  
  // 3秒后自动消失
  setTimeout(() => {
    toast.style.opacity = '0'
    setTimeout(() => {
      document.body.removeChild(toast)
    }, 300)
  }, 3000)
}

// 创建浮窗UI
const createFloatingWindow = (container: HTMLElement) => {
  console.log('Creating floating window')
  const floatingWindow = document.createElement('div')
  floatingWindow.style.cssText = `
    position: absolute;
    top: 10px;
    right: 10px;
    background: white;
    padding: 10px;
    border-radius: 4px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    z-index: 9999;
    pointer-events: auto;
  `
  
  const uploadButton = document.createElement('button')
  uploadButton.textContent = '简历入库'
  uploadButton.style.cssText = `
    background: #ff4500;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    pointer-events: auto;
    position: relative;
    z-index: 10000;
    font-size: 12px;
  `
  uploadButton.type = 'button'
  
  const status = document.createElement('div')
  status.style.cssText = `
    margin-top: 5px;
    font-size: 12px;
    color: #666;
    pointer-events: none;
  `
  
  floatingWindow.appendChild(uploadButton)
  floatingWindow.appendChild(status)
  
  return {
    window: floatingWindow,
    uploadButton,
    status
  }
}

// 处理PDF上传
const handlePdfUpload = async (pdfUrl: string, fileName: string, status: HTMLElement) => {
  try {
    status.textContent = '正在处理...'
    console.log('Starting PDF upload process...')
    
    // 获取PDF文件内容
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
      status.textContent = ''
      throw new Error('获取PDF失败')
    }
    
    const blob = await pdfResponse.blob()
    const file = new File([blob], fileName, { 
      type: 'application/pdf',
      lastModified: new Date().getTime()
    })
    console.log('PDF file created:', fileName, 'MIME type:', file.type)

    // 获取认证令牌
    const result = await chrome.storage.local.get(['access_token'])
    const token = result.access_token

    if (!token) {
      status.textContent = ''
      throw new Error('未登录，请先登录')
    }

    status.textContent = '正在入库...'
    console.log('准备发送请求，文件大小:', file.size, '文件名:', fileName)

    try {
      const formData = new FormData()
      formData.append('file', file)

      console.log('发送请求到服务器...')
      const response = await fetch(`${API_BASE_URL}/resume/upload`, {
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
        status.textContent = '入库成功！'
        setTimeout(() => {
          status.textContent = ''
        }, 3000)
        return true
      } else {
        status.textContent = ''
        throw new Error(result.message || '上传失败')
      }
    } catch (error) {
      console.error('上传请求失败:', error)
      status.textContent = ''
      throw error
    }
  } catch (error) {
    console.error('Error in handlePdfUpload:', error)
    status.textContent = ''
    if (error.name === 'AbortError') {
      throw new Error('请求超时，请重试')
    } else {
      throw error
    }
  }
}

// 处理PDF附件
const handlePdfAttachment = (attachmentElement: HTMLElement) => {
  // 检查是否已经添加过浮窗
  if (attachmentElement.querySelector('.resume-upload-window')) {
    return
  }

  // 设置附件容器的宽度
  attachmentElement.style.width = '500px'

  // 获取PDF文件名和下载链接
  const fileNameElement = attachmentElement.querySelector('.info_name')
  const downloadLink = attachmentElement.querySelector('.attach_download') as HTMLAnchorElement
  
  if (!fileNameElement || !downloadLink) {
    console.log('未找到文件名或下载链接')
    return
  }

  const fileName = fileNameElement.textContent
  const pdfUrl = downloadLink.href

  if (!fileName || !pdfUrl) {
    console.log('文件名或下载链接为空')
    return
  }

  // 创建并添加浮窗
  const { window: floatingWindow, uploadButton, status } = createFloatingWindow(attachmentElement)
  floatingWindow.classList.add('resume-upload-window')
  
  // 设置浮窗样式
  floatingWindow.style.cssText = `
    position: absolute;
    top: 50%;
    right: 10px;
    transform: translateY(-50%);
    background: white;
    padding: 10px;
    border-radius: 4px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    z-index: 9999;
    pointer-events: auto;
    margin-right: 150px;
  `

  // 确保附件元素可以定位浮窗
  attachmentElement.style.position = 'relative'
  
  // 添加点击事件
  const handleClick = async (event: MouseEvent) => {
    console.log('按钮被点击')
    event.preventDefault()
    event.stopPropagation()
    console.log('开始上传:', pdfUrl, fileName)
    try {
      const success = await handlePdfUpload(pdfUrl, fileName, status)
      if (success) {
        createToast('入库成功！')
      }
    } catch (error) {
      console.error('上传失败:', error)
      createToast(`上传失败：${error.message}`)
    }
  }

  uploadButton.addEventListener('click', handleClick, true)
  uploadButton.onclick = handleClick

  attachmentElement.appendChild(floatingWindow)
  console.log('浮窗已添加到附件元素')
}

// 监听页面变化
const observePage = () => {
  console.log('开始监听页面变化')
  
  // 处理现有的PDF附件
  console.log('开始查找附件列表...')
  const attachments = document.querySelectorAll('.att_bt')
  console.log('找到附件数量:', attachments.length)
  
  if (attachments.length === 0) {
    // 如果没有找到附件，尝试其他可能的选择器
    console.log('尝试其他选择器...')
    const possibleSelectors = [
      '.att_bt',
      '[class*="att_bt"]',
      '.attachment-list .att_bt',
      '.mail_content .att_bt',
      '.attachments .att_bt',
      '.mail_attach .att_bt'
    ]
    
    for (const selector of possibleSelectors) {
      const elements = document.querySelectorAll(selector)
      console.log(`使用选择器 ${selector} 找到元素数量:`, elements.length)
      if (elements.length > 0) {
        console.log('找到附件列表，开始处理...')
        elements.forEach((attachment) => {
          if (attachment instanceof HTMLElement) {
            console.log('处理附件元素:', attachment)
            const isPdf = attachment.querySelector('img[src*="fu_pdf.gif"]')
            if (isPdf) {
              console.log('找到PDF附件，开始处理...')
              handlePdfAttachment(attachment)
            } else {
              console.log('不是PDF附件，跳过')
            }
          }
        })
        break
      }
    }
  } else {
    console.log('找到附件列表，开始处理...')
    attachments.forEach((attachment) => {
      if (attachment instanceof HTMLElement) {
        console.log('处理附件元素:', attachment)
        const isPdf = attachment.querySelector('img[src*="fu_pdf.gif"]')
        if (isPdf) {
          console.log('找到PDF附件，开始处理...')
          handlePdfAttachment(attachment)
        } else {
          console.log('不是PDF附件，跳过')
        }
      }
    })
  }

  // 监听新增的附件
  const observer = new MutationObserver((mutations) => {
    console.log('检测到DOM变化')
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        console.log('新增节点数量:', mutation.addedNodes.length)
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            console.log('处理新增节点:', node)
            // 检查新增的节点是否是PDF附件
            const pdfAttachments = node.querySelectorAll('.att_bt')
            console.log('在新增节点中找到附件数量:', pdfAttachments.length)
            pdfAttachments.forEach((attachment) => {
              if (attachment instanceof HTMLElement) {
                console.log('处理新增附件元素:', attachment)
                const isPdf = attachment.querySelector('img[src*="fu_pdf.gif"]')
                if (isPdf) {
                  console.log('找到新增的PDF附件，开始处理...')
                  handlePdfAttachment(attachment)
                } else {
                  console.log('新增的不是PDF附件，跳过')
                }
              }
            })
          }
        })
      }
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
  document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded 事件触发')
    // 延迟执行，确保页面完全加载
    setTimeout(() => {
      console.log('开始执行observePage')
      observePage()
    }, 1000)
  })
} else {
  console.log('DOM already loaded, running observePage immediately')
  // 延迟执行，确保页面完全加载
  setTimeout(() => {
    console.log('开始执行observePage')
    observePage()
  }, 1000)
} 