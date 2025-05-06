/// <reference types="chrome"/>

import type { PlasmoCSConfig } from "plasmo"
import { config as envConfig } from '../config/env';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { createToast } from '../lib/ui-utils';

export const config: PlasmoCSConfig = {
  matches: ["https://h.liepin.com/resume/showresumedetail/*"],
  all_frames: true,
  run_at: "document_end"
}

console.log('猎聘猎头版Content script loaded')

// 等待目标容器加载
const waitForTargetContainer = (): Promise<HTMLElement> => {
  return new Promise((resolve) => {
    const checkContainer = () => {
      const container = document.querySelector('.c-resume-body-cont') as HTMLElement
      if (container) {
        console.log('找到目标容器')
        resolve(container)
      } else {
        console.log('目标容器未找到，等待1000ms后重试')
        setTimeout(checkContainer, 1000)
      }
    }
    checkContainer()
  })
}

// 创建浮窗UI
const createFloatingWindow = async (title = '推鲤 AI 快聘', buttonText = '简历入库', position = 'bottom') => {
  console.log('Creating floating window:', title)
  const floatingWindow = document.createElement('div')
  
  // 根据位置设置不同的样式
  const positionStyle = position === 'bottom' 
    ? 'bottom: 20px;' 
    : 'bottom: 160px;'; // 上面的窗口位置较高，增加间距
  
  floatingWindow.style.cssText = `
    position: fixed;
    ${positionStyle}
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
  
  const titleElement = document.createElement('div')
  titleElement.textContent = title
  titleElement.style.cssText = `
    font-size: 16px;
    font-weight: bold;
    margin-bottom: 10px;
    pointer-events: none;
  `
  
  const uploadButton = document.createElement('button')
  uploadButton.textContent = buttonText
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
  
  floatingWindow.appendChild(titleElement)
  floatingWindow.appendChild(uploadButton)
  floatingWindow.appendChild(status)
  
  return {
    window: floatingWindow,
    uploadButton,
    status
  }
}

// 处理PDF上传
const handlePdfUpload = async (pdfUrl: string, fileName: string, status: HTMLElement, jobTitle: string) => {
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
      formData.append('deliveryChannel', '猎聘-猎头版')
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

// 将在线简历转换为文件
const convertOnlineResumeToFile = async (status: HTMLElement): Promise<File | null> => {
  try {
    status.textContent = '正在生成PDF...'
    console.log('开始将在线简历转换为PDF文件...')
    
    try {
      const resumeContent = document.querySelector('.c-resume-body-cont') as HTMLElement
      if (!resumeContent) {
        console.error('未找到简历内容元素')
        status.textContent = '未找到简历内容'
        return null
      }
      
      console.log('找到简历内容元素，开始生成PDF')
      // 应用打印样式
      const originalStyle = resumeContent.style.cssText
      const printStyle = `
        background-color: white;
        width: 210mm;
        margin: 0 auto;
        padding: 10mm;
      `
      resumeContent.style.cssText += printStyle
      
      // 计算宽高比例
      const scale = 1
      const pageWidth = 210  // A4宽度，单位毫米
      const pageWidthInPx = pageWidth * 3.779527559 // 转换为像素
      
      // 创建PDF实例
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })
      
      console.log('开始渲染简历内容为canvas')
      let canvas, imgData, contentWidth, contentHeight, contentHeightInMm
      
      try {
        canvas = await html2canvas(resumeContent, {
          scale: scale,
          useCORS: true,
          logging: false,
          allowTaint: true,
          backgroundColor: '#ffffff'
        })
        
        console.log('渲染完成，canvas尺寸:', canvas.width, 'x', canvas.height)
        
        // 如果画布的宽度超过PDF的预定义宽度，则按比例缩放
        contentWidth = Math.min(pageWidthInPx, canvas.width)
        contentHeight = canvas.height * (contentWidth / canvas.width)
        
        console.log('缩放后内容尺寸:', contentWidth, 'x', contentHeight)
        console.log('PDF页面尺寸(mm):', pageWidth, 'x', pdf.internal.pageSize.getHeight())
        
        // 将Canvas转换为图片
        imgData = canvas.toDataURL('image/jpeg', 0.95)
        
        // 将图片添加到PDF
        // 由于内容可能很长，需要分页
        const pdfWidth = pdf.internal.pageSize.getWidth()
        const pdfHeight = pdf.internal.pageSize.getHeight()
        
        // 计算缩放比例 (mm/px)
        const pxToMmRatio = pdfWidth / contentWidth
        
        // 转换内容高度为mm
        contentHeightInMm = contentHeight * pxToMmRatio
        
        // 将内容分页
        let remainingHeight = contentHeightInMm
        let yOffset = 0 // 使用mm单位
        
        console.log('开始分页，总高度(mm):', contentHeightInMm)
        
        while (remainingHeight > 0) {
          // 创建当前页的canvas切片
          const currentPageHeight = Math.min(remainingHeight, pdfHeight)
          
          // 添加图片到PDF，根据当前页的切片位置
          pdf.addImage(
            imgData,
            'JPEG',
            0, // x坐标
            yOffset > 0 ? -pdfHeight + yOffset % pdfHeight : 0, // y坐标，根据偏移计算
            pdfWidth,
            contentHeightInMm * (pdfWidth / pageWidth)
          )
          
          // 更新剩余高度和偏移量
          remainingHeight -= currentPageHeight
          yOffset += currentPageHeight
          
          // 如果还有内容，添加新页
          if (remainingHeight > 0) {
            pdf.addPage()
          }
        }
      } catch (renderError) {
        console.error('html2canvas渲染失败:', renderError)
        console.error('错误详情:', {
          message: renderError.message,
          stack: renderError.stack,
          name: renderError.name
        })
        throw renderError
      }
      
      // 还原原来的样式
      resumeContent.style.cssText = originalStyle
      
      // 转换成文件
      const pdfBlob = pdf.output('blob')
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const fileName = `猎聘猎头版在线简历_${timestamp}.pdf`
      
      const file = new File([pdfBlob], fileName, {
        type: 'application/pdf',
        lastModified: new Date().getTime()
      })
      
      console.log(`成功创建PDF文件: ${fileName}, 大小: ${file.size} 字节`)
      status.textContent = 'PDF生成成功'
      return file
      
    } catch (importError) {
      console.error('使用jsPDF或html2canvas失败:', importError)
      status.textContent = '生成PDF失败'
      return null
    }
    
  } catch (error) {
    console.error('转换在线简历时出错:', error)
    status.textContent = '处理简历失败'
    return null
  }
};

// 处理在线简历上传
const handleOnlineResumeUpload = async (file: File, status: HTMLElement, jobTitle: string) => {
  try {
    status.textContent = '正在入库...'
    console.log('准备发送在线简历请求，文件大小:', file.size, '文件名:', file.name)

    // 获取认证令牌
    const result = await chrome.storage.local.get(['access_token'])
    const token = result.access_token

    if (!token) {
      status.textContent = '未登录，请先登录'
      throw new Error('未登录，请先登录')
    }

    // 直接发送请求到服务器
    const formData = new FormData()
    formData.append('file', file)
    formData.append('deliveryChannel', '猎聘-猎头版')
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
    const responseData = await response.json()
    console.log('服务器响应:', responseData)

    if (response.ok) {
      status.textContent = '入库成功！'
      return true
    } else {
      // 处理服务器返回的错误信息
      status.textContent = '入库失败!'
      throw new Error(responseData.message || '入库失败')
    }
  } catch (error) {
    console.error('上传请求失败:', error)
    status.textContent = '入库失败!'
    throw error
  }
}

// 获取应聘职位
const getJobTitle = (): string => {
  const alertMessage = document.querySelector('.ant-alert-message')
  if (alertMessage) {
    const text = alertMessage.textContent || ''
    const match = text.match(/应聘职位：(.*?)　　/)
    if (match && match[1]) {
      return match[1].trim()
    }
  }
  return '已关闭的职位'
}

// 监听页面变化，查找下载链接和在线简历
const observePage = async () => {
  console.log('开始监听页面变化')
  
  // 创建两个浮窗 - 在线简历和附件简历
  const onlineResumeWindow = await createFloatingWindow('推鲤 AI 快聘 - 在线简历', '在线简历入库', 'bottom')
  const attachmentResumeWindow = await createFloatingWindow('推鲤 AI 快聘 - 附件简历', '附件简历入库', 'top')
  
  document.body.appendChild(onlineResumeWindow.window)
  document.body.appendChild(attachmentResumeWindow.window)
  
  // 处理简历元素
  const handleResume = async () => {
    try {
      // 获取职位信息
      const jobTitle = getJobTitle()
      console.log('当前职位:', jobTitle)

      // 检查在线简历
      const onlineResume = document.querySelector('.c-resume-body-cont')
      console.log('在线简历元素:', !!onlineResume)
      
      // 显示/隐藏在线简历浮窗
      if (onlineResume) {
        console.log('找到在线简历，显示在线简历浮窗')
        onlineResumeWindow.window.style.display = 'block'
        
        // 为在线简历按钮添加点击事件
        if (!onlineResumeWindow.uploadButton.hasAttribute('data-has-listener')) {
          onlineResumeWindow.uploadButton.setAttribute('data-has-listener', 'true')
          onlineResumeWindow.uploadButton.addEventListener('click', async (event) => {
            event.preventDefault()
            event.stopPropagation()
            
            // 设置处理中标志
            onlineResumeWindow.window.setAttribute('data-processing', 'true')
            
            // 禁用按钮
            onlineResumeWindow.uploadButton.disabled = true
            onlineResumeWindow.uploadButton.style.opacity = '0.6'
            onlineResumeWindow.uploadButton.style.cursor = 'not-allowed'
            
            // 处理在线简历
            try {
              onlineResumeWindow.status.textContent = '正在处理在线简历...'
              const resumeFile = await convertOnlineResumeToFile(onlineResumeWindow.status)
              if (resumeFile) {
                const success = await handleOnlineResumeUpload(resumeFile, onlineResumeWindow.status, jobTitle)
                if (success) {
                  onlineResumeWindow.status.textContent = '入库成功！'
                  createToast('在线简历入库成功！')
                }
              }
            } catch (error) {
              console.error('在线简历处理失败:', error)
              onlineResumeWindow.status.textContent = '入库失败!'
              createToast(`在线简历入库失败：${error.message}`)
            } finally {
              // 延迟恢复按钮状态和清除状态文本
              setTimeout(() => {
                onlineResumeWindow.uploadButton.disabled = false
                onlineResumeWindow.uploadButton.style.opacity = '1'
                onlineResumeWindow.uploadButton.style.cursor = 'pointer'
                onlineResumeWindow.window.setAttribute('data-processing', 'false')
                // 清空状态文本
                onlineResumeWindow.status.textContent = ''
              }, 3000)
            }
          }, true)
        }
      } else {
        onlineResumeWindow.window.style.display = 'none'
      }
      
      // 检查附件简历
      const accessoryResumeWrap = document.querySelector('.accessory-resume-wrap')
      console.log('附件简历容器:', !!accessoryResumeWrap)
      
      if (accessoryResumeWrap) {
        attachmentResumeWindow.window.style.display = 'block'
        
        // 查找下载链接
        const downloadLink = accessoryResumeWrap.querySelector('a.download') as HTMLAnchorElement
        if (downloadLink) {
          console.log('找到下载链接:', downloadLink.href)
          
          // 获取文件名
          const pdfNameElem = accessoryResumeWrap.querySelector('.pdf-name-p')
          const fileName = pdfNameElem ? pdfNameElem.textContent?.trim() || '简历.pdf' : '简历.pdf'
          
          // 为附件简历按钮添加点击事件
          if (!attachmentResumeWindow.uploadButton.hasAttribute('data-has-listener')) {
            attachmentResumeWindow.uploadButton.setAttribute('data-has-listener', 'true')
            
            attachmentResumeWindow.uploadButton.addEventListener('click', async (event) => {
              console.log('附件简历按钮被点击')
              event.preventDefault()
              event.stopPropagation()
              
              // 设置处理中标志
              attachmentResumeWindow.window.setAttribute('data-processing', 'true')
              
              // 禁用按钮，防止重复点击
              attachmentResumeWindow.uploadButton.disabled = true
              attachmentResumeWindow.uploadButton.style.opacity = '0.6'
              attachmentResumeWindow.uploadButton.style.cursor = 'not-allowed'
              
              try {
                // 处理附件简历
                attachmentResumeWindow.status.textContent = '正在处理附件简历...'
                createToast('正在处理附件简历，请稍候...')
                
                const success = await handlePdfUpload(
                  downloadLink.href,
                  fileName,
                  attachmentResumeWindow.status,
                  jobTitle
                )
                
                if (success) {
                  attachmentResumeWindow.status.textContent = '入库成功！'
                  createToast('附件简历入库成功！')
                }
              } catch (error) {
                console.error('附件简历处理失败:', error)
                attachmentResumeWindow.status.textContent = '入库失败!'
                createToast(`附件简历入库失败：${error.message}`)
              } finally {
                // 延迟恢复按钮状态
                setTimeout(() => {
                  attachmentResumeWindow.uploadButton.disabled = false
                  attachmentResumeWindow.uploadButton.style.opacity = '1'
                  attachmentResumeWindow.uploadButton.style.cursor = 'pointer'
                  attachmentResumeWindow.window.setAttribute('data-processing', 'false')
                  // 清空状态文本
                  attachmentResumeWindow.status.textContent = ''
                }, 3000)
              }
            }, true)
          }
        } else {
          console.log('未找到附件简历下载链接')
          attachmentResumeWindow.window.style.display = 'none'
        }
      } else {
        attachmentResumeWindow.window.style.display = 'none'
      }
    } catch (error) {
      console.error('处理简历时出错:', error)
      onlineResumeWindow.window.style.display = 'none'
      attachmentResumeWindow.window.style.display = 'none'
    }
  }

  // 初始处理
  handleResume()

  // 监听DOM变化
  const observer = new MutationObserver(() => {
    handleResume()
  })

  // 开始观察
  observer.observe(document.body, {
    childList: true,
    subtree: true
  })
  console.log('MutationObserver已启动')
}

// 开始执行
observePage() 