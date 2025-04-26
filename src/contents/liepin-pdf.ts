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
        console.log('目标容器未找到，等待1000ms后重试')
        setTimeout(checkContainer, 10000)
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
    pointer-events: auto;
  `
  
  const title = document.createElement('div')
  title.textContent = '推鲤 AI 快聘'
  title.style.cssText = `
    font-size: 16px;
    font-weight: bold;
    margin-bottom: 10px;
    pointer-events: none;
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
    pointer-events: auto;
    position: relative;
    z-index: 10000;
  `
  uploadButton.type = 'button'
  
  const status = document.createElement('div')
  status.style.cssText = `
    margin-top: 10px;
    font-size: 14px;
    color: #666;
    pointer-events: none;
  `
  
  floatingWindow.appendChild(title)
  floatingWindow.appendChild(uploadButton)
  floatingWindow.appendChild(status)
  
  return {
    window: floatingWindow,
    uploadButton,
    status
  }
}

// 添加浮窗到目标容器
const addFloatingWindowToContainer = (targetContainer: HTMLElement, floatingWindow: HTMLElement) => {
  console.log('添加浮窗到目标容器')
  targetContainer.style.position = 'relative'
  targetContainer.appendChild(floatingWindow)
}

// 监听目标容器的变化
const observeTargetContainer = () => {
  console.log('开始监听目标容器变化')
  const observer = new MutationObserver(async (mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        // 检查新增的节点
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement) {
            // 检查新增的节点是否包含目标容器
            const targetContainer = node.querySelector('.resume-detail-container')
            if (targetContainer instanceof HTMLElement) {
              console.log('发现新的目标容器')
              const { window: floatingWindow } = await createFloatingWindow()
              addFloatingWindowToContainer(targetContainer, floatingWindow)
            }
          }
        }
      }
    }
  })

  // 开始观察整个文档
  observer.observe(document.body, {
    childList: true,
    subtree: true
  })

  // 初始检查
  const initialContainer = document.querySelector('.resume-detail-container')
  if (initialContainer instanceof HTMLElement) {
    console.log('找到初始目标容器')
    createFloatingWindow().then(({ window: floatingWindow }) => {
      addFloatingWindowToContainer(initialContainer, floatingWindow)
    })
  }
}

// 启动监听
observeTargetContainer()

// 处理PDF上传
const handlePdfUpload = async (pdfUrl: string, fileName: string, status: HTMLElement) => {
  try {
    status.textContent = '正在处理...'
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
      status.textContent = '获取PDF失败'
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
      status.textContent = '未登录，请先登录'
      throw new Error('未登录，请先登录')
    }

    status.textContent = '正在入库...'
    console.log('准备发送请求，文件大小:', file.size, '文件名:', fileName)

    try {
      // 直接发送请求到服务器
      const formData = new FormData()
      formData.append('file', file)
      formData.append('deliveryChannel', '猎聘')
      const jobTitle = document.querySelector('.ant-im-btn-link span')?.textContent?.trim() || '未知岗位'
      formData.append('deliveryPosition', jobTitle)
      console.log('发送请求到服务器，职位:', jobTitle)

      console.log('发送请求到服务器...')
      const response = await fetch(`${envConfig.API_BASE_URL}/resume/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include',
        mode: 'cors',
        body: formData
      })

      console.log('服务器响应状态:', response.status)
      const result = await response.json()
      console.log('服务器响应:', result)

      if (response.ok) {
        status.textContent = '入库成功！'
        return true
      } else {
        // 处理服务器返回的错误信息
        status.textContent = '入库失败!'
        throw new Error(result.message || '入库失败')
      }
    } catch (error) {
      console.error('上传请求失败:', error)
      status.textContent = '入库失败!'
      throw error
    }
  } catch (error) {
    console.error('Error in handlePdfUpload:', error)
    if (error.name === 'AbortError') {
      status.textContent = '请求超时，请重试'
      throw new Error('请求超时，请重试')
    } else {
      status.textContent = '入库失败!'
      throw error
    }
  }
}

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

// 检查并处理PDF链接
const checkAndHandlePdfLinks = (
  element: Element,
  floatingWindow: HTMLElement,
  uploadButton: HTMLButtonElement,
  status: HTMLElement
) => {
  console.log('检查元素中的PDF链接:', element)
  
  // 检查浮窗是否正在处理中
  const isProcessing = floatingWindow.getAttribute('data-processing') === 'true'
  if (isProcessing) {
    console.log('浮窗正在处理中，不重新创建')
    // 确保浮窗仍然显示
    floatingWindow.style.display = 'block'
    return
  }
  
  // 首先检查元素本身是否是下载链接
  let foundPdfUrl: string | null = null
  let foundFileName: string | null = null
  
  if (element instanceof HTMLAnchorElement && element.classList.contains('download--SCDVl')) {
    console.log('元素本身是下载链接:', element.href)
    const pdfUrl = element.href
    const urlParams = new URLSearchParams(pdfUrl.split('?')[1])
    const encodedFileName = urlParams.get('dlFileName')
    const baseFileName = encodedFileName ? decodeURIComponent(encodedFileName) : 'resume'
    // 确保文件名以.pdf结尾
    const fileName = baseFileName.endsWith('.pdf') ? baseFileName : `${baseFileName}.pdf`
    
    foundPdfUrl = pdfUrl
    foundFileName = fileName
  }
  
  // 然后检查子元素中的下载链接
  if (!foundPdfUrl) {
    const downloadLinks = element.querySelectorAll('a.download--SCDVl')
    console.log('找到下载链接数量:', downloadLinks.length)
    
    // 只处理第一个链接
    if (downloadLinks.length > 0) {
      const firstLink = downloadLinks[0]
      if (firstLink instanceof HTMLAnchorElement) {
        console.log('处理第一个下载链接:', firstLink.href)
        const pdfUrl = firstLink.href
        const urlParams = new URLSearchParams(pdfUrl.split('?')[1])
        const encodedFileName = urlParams.get('dlFileName')
        const baseFileName = encodedFileName ? decodeURIComponent(encodedFileName) : 'resume'
        // 确保文件名以.pdf结尾
        const fileName = baseFileName.endsWith('.pdf') ? baseFileName : `${baseFileName}.pdf`
        
        foundPdfUrl = pdfUrl
        foundFileName = fileName
      }
    }
  }

  // 只有在找到PDF链接时才显示浮窗和设置上传按钮事件
  if (foundPdfUrl && foundFileName) {
    console.log('找到PDF链接，显示浮窗，URL:', foundPdfUrl, '文件名:', foundFileName)
    floatingWindow.style.display = 'block'
    
    // 清空浮窗内容
    floatingWindow.innerHTML = ''
    
    // 创建标题
    const title = document.createElement('div')
    title.textContent = '推鲤 AI 快聘'
    title.style.cssText = `
      font-size: 16px;
      font-weight: bold;
      margin-bottom: 10px;
      pointer-events: none;
    `
    
    // 创建全新的按钮
    const finalButton = document.createElement('button')
    finalButton.textContent = '简历入库'
    finalButton.style.cssText = `
      background: #ff4500;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      pointer-events: auto;
      position: relative;
      z-index: 10000;
    `
    finalButton.type = 'button'
    
    // 创建新的status元素
    const newStatus = document.createElement('div')
    newStatus.style.cssText = `
      margin-top: 10px;
      font-size: 14px;
      color: #666;
      pointer-events: none;
    `
    
    // 按顺序添加元素到浮窗
    floatingWindow.appendChild(title)
    floatingWindow.appendChild(finalButton)
    floatingWindow.appendChild(newStatus)
    
    // 添加新的事件监听器
    const handleClick = async (event: MouseEvent) => {
      console.log('按钮被点击')
      event.preventDefault()
      event.stopPropagation()
      console.log('开始上传:', foundPdfUrl, foundFileName)
      
      // 设置处理中标志
      floatingWindow.setAttribute('data-processing', 'true')
      
      // 禁用按钮，防止重复点击
      finalButton.disabled = true
      finalButton.style.opacity = '0.6'
      finalButton.style.cursor = 'not-allowed'
      
      try {
        const success = await handlePdfUpload(foundPdfUrl, foundFileName, newStatus)
        if (success) {
          createToast('入库成功！')
          // 延迟清空状态文本，给用户足够时间看到成功消息
          setTimeout(() => {
            newStatus.textContent = ''
            // 恢复按钮状态
            finalButton.disabled = false
            finalButton.style.opacity = '1'
            finalButton.style.cursor = 'pointer'
            // 清除处理中标志
            floatingWindow.setAttribute('data-processing', 'false')
          }, 3000)
        }
      } catch (error) {
        console.error('入库失败:', error)
        createToast(`入库失败：${error.message}`)
        // 延迟清空错误状态
        setTimeout(() => {
          newStatus.textContent = ''
          // 恢复按钮状态
          finalButton.disabled = false
          finalButton.style.opacity = '1'
          finalButton.style.cursor = 'pointer'
          // 清除处理中标志
          floatingWindow.setAttribute('data-processing', 'false')
        }, 3000)
      }
    }
    
    // 只添加一次事件监听器
    finalButton.addEventListener('click', handleClick, true)
    
    // 确保按钮可点击
    finalButton.style.pointerEvents = 'auto'
    finalButton.style.position = 'relative'
    finalButton.style.zIndex = '10000'
    
    // 更新status引用
    status = newStatus
  } else {
    // 只有在不处理中时才隐藏浮窗
    if (!isProcessing) {
      console.log('未找到PDF链接，隐藏浮窗')
      floatingWindow.style.display = 'none'
    }
  }
}

// 监听页面变化，查找下载链接
const observePage = async () => {
  console.log('开始监听页面变化')
  const { window: floatingWindow, uploadButton, status } = await createFloatingWindow()

  // 检查目标容器是否存在并处理浮窗
  const handleTargetContainer = async () => {
    try {
      console.log('等待目标容器加载...')
      const targetContainer = await waitForTargetContainer()
      console.log('目标容器加载完成，开始处理')
      
      targetContainer.style.position = 'relative'
      
      // 确保浮窗不在其他容器中
      if (floatingWindow.parentElement) {
        floatingWindow.parentElement.removeChild(floatingWindow)
      }
      
      // 设置浮窗样式
      floatingWindow.style.position = 'absolute'
      floatingWindow.style.bottom = '20px'
      floatingWindow.style.right = '20px'
      floatingWindow.style.display = 'none' // 初始状态设为隐藏
      
      targetContainer.appendChild(floatingWindow)
      console.log('浮窗已添加到目标容器')
      
      // 等待一小段时间确保DOM完全渲染
      setTimeout(() => {
        console.log('开始检查PDF链接')
        // 检查整个文档中的PDF链接
        const allDownloadLinks = document.querySelectorAll('a.download--SCDVl')
        console.log('找到所有下载链接数量:', allDownloadLinks.length)
        
        if (allDownloadLinks.length > 0) {
          // 如果找到下载链接，检查并处理
          checkAndHandlePdfLinks(targetContainer, floatingWindow, uploadButton, status)
        } else {
          console.log('未找到下载链接，隐藏浮窗')
          floatingWindow.style.display = 'none'
        }
      }, 500)
    } catch (error) {
      console.error('处理目标容器时出错:', error)
      floatingWindow.style.display = 'none'
      if (floatingWindow.parentElement) {
        floatingWindow.parentElement.removeChild(floatingWindow)
      }
    }
  }

  // 初始检查
  handleTargetContainer()

  const observer = new MutationObserver((mutations) => {
    let needsCheck = false

    for (const mutation of mutations) {
      // 检查新增或删除的节点是否影响目标容器
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            if (node.classList?.contains('ant-lpt-modal-body') || 
                node.querySelector?.('.ant-lpt-modal-body')) {
              needsCheck = true
              console.log('检测到目标容器相关变化')
            }
          }
        })

        mutation.removedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            if (node.classList?.contains('ant-lpt-modal-body') || 
                node.querySelector?.('.ant-lpt-modal-body')) {
              needsCheck = true
              console.log('检测到目标容器被移除')
            }
          }
        })
      }
    }

    // 如果检测到目标容器相关变化，重新处理浮窗
    if (needsCheck) {
      console.log('重新处理浮窗')
      handleTargetContainer()
    }
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