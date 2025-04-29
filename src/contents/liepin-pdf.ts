/// <reference types="chrome"/>

import type { PlasmoCSConfig } from "plasmo"
import { config as envConfig } from '../config/env';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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
const createFloatingWindow = async (title = '推鲤 AI 快聘', buttonText = '简历入库', position = 'bottom') => {
  console.log('Creating floating window:', title)
  const floatingWindow = document.createElement('div')
  
  // 根据位置设置不同的样式
  const positionStyle = position === 'bottom' 
    ? 'bottom: 20px;' 
    : 'bottom: 160px;'; // 上面的窗口位置较高，增加间距
  
  floatingWindow.style.cssText = `
    position: absolute;
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

// 转换在线简历为PDF文件
const convertOnlineResumeToFile = async (status: HTMLElement): Promise<File | null> => {
  try {
    console.log('开始转换在线简历为PDF');
    status.textContent = '正在处理在线简历...';
    
    // 查找简历容器 - 猎聘的在线简历元素
    const resumeContainer = document.querySelector('.content--dw5Ml') as HTMLElement;
    if (!resumeContainer) {
      console.error('找不到简历容器');
      status.textContent = '找不到简历内容';
      return null;
    }
    
    try {
      status.textContent = '正在生成PDF...';
      
      // 创建PDF
      console.log("生成包含简历内容的PDF");
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      // 尝试将HTML渲染到PDF
      try {
        console.log('尝试使用html2canvas渲染简历容器');
        status.textContent = '正在渲染简历...';

        const infoSection = resumeContainer;
        console.log('准备渲染的元素:', infoSection);
        
        // 渲染前记录元素尺寸和位置
        const rect = infoSection.getBoundingClientRect();
        console.log('元素尺寸:', { 
          width: rect.width, 
          height: rect.height,
          visibleOnScreen: rect.top < window.innerHeight && rect.bottom > 0
        });
        
        // 使用html2canvas渲染
        const canvas = await html2canvas(infoSection as HTMLElement, {
          scale: 2, // 提高缩放比例以提高质量
          logging: true, // 开启日志
          useCORS: true, // 允许跨域图像
          allowTaint: true, // 允许污染canvas
          backgroundColor: '#ffffff', // 白色背景
          windowWidth: window.innerWidth,
          windowHeight: window.innerHeight,
          scrollX: 0,
          scrollY: 0,
          x: 0,
          y: 0,
          width: rect.width,
          height: rect.height
        });
        
        console.log('html2canvas渲染成功，canvas尺寸:', {
          width: canvas.width,
          height: canvas.height
        });
        
        // 将canvas添加到PDF，根据A4纸比例计算尺寸
        const imgData = canvas.toDataURL('image/jpeg', 0.9);
        
        // A4纸尺寸(mm): 210 x 297，保留10mm边距
        const pageWidth = 210;
        const pageHeight = 297;
        const margin = 10;
        const contentWidth = pageWidth - 2 * margin;
        const contentHeight = pageHeight - 2 * margin;
        
        // 计算canvas与PDF的缩放比例
        const scale = contentWidth / canvas.width;
        
        // 计算按比例缩放后的canvas高度
        const scaledHeight = canvas.height * scale;
        
        console.log('计算缩放比例:', {
          scale,
          contentWidth,
          scaledHeight,
          totalPages: Math.ceil(scaledHeight / contentHeight)
        });
        
        // 多页处理
        if (scaledHeight <= contentHeight) {
          // 单页足够
          pdf.addImage(imgData, 'JPEG', margin, margin, contentWidth, scaledHeight);
        } else {
          // 需要多页处理
          // 计算每页可以显示的canvas高度
          const pageHeightInPx = contentHeight / scale;
          
          let remainingHeight = canvas.height;
          let yOffset = 0;
          
          // 循环添加页面
          while (remainingHeight > 0) {
            // 创建当前页的canvas切片
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            
            // 确定当前页的高度
            const currentPageHeight = Math.min(pageHeightInPx, remainingHeight);
            
            // 设置临时canvas的尺寸
            tempCanvas.width = canvas.width;
            tempCanvas.height = currentPageHeight;
            
            // 将主canvas对应部分绘制到临时canvas
            tempCtx.drawImage(
              canvas,
              0, yOffset,                  // 源图像的起始坐标
              canvas.width, currentPageHeight, // 源图像的宽度和高度
              0, 0,                        // 目标canvas的起始坐标
              canvas.width, currentPageHeight  // 目标canvas的宽度和高度
            );
            
            // 将临时canvas转为图像并添加到PDF
            const pageImgData = tempCanvas.toDataURL('image/jpeg', 0.9);
            
            // 添加图像到PDF
            pdf.addImage(
              pageImgData, 
              'JPEG', 
              margin, margin, 
              contentWidth, currentPageHeight * scale
            );
            
            // 更新剩余高度和偏移量
            remainingHeight -= currentPageHeight;
            yOffset += currentPageHeight;
            
            // 如果还有内容，添加新页
            if (remainingHeight > 0) {
              pdf.addPage();
            }
          }
        }
        
      } catch (renderError) {
        console.error('html2canvas渲染失败:', renderError);
        console.error('错误详情:', {
          message: renderError.message,
          stack: renderError.stack,
          name: renderError.name
        });
      }
      
      // 转换成文件
      const pdfBlob = pdf.output('blob');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `猎聘在线简历_${timestamp}.pdf`;
      
      const file = new File([pdfBlob], fileName, {
        type: 'application/pdf',
        lastModified: new Date().getTime()
      });
      
      console.log(`成功创建PDF文件: ${fileName}, 大小: ${file.size} 字节`);
      status.textContent = 'PDF生成成功';
      return file;
      
    } catch (importError) {
      console.error('使用jsPDF或html2canvas失败:', importError);
      status.textContent = '生成PDF失败';
      return null;
    }
    
  } catch (error) {
    console.error('转换在线简历时出错:', error);
    status.textContent = '处理简历失败';
    return null;
  }
};

// 处理在线简历上传
const handleOnlineResumeUpload = async (file: File, status: HTMLElement) => {
  try {
    status.textContent = '正在入库...';
    console.log('准备发送在线简历请求，文件大小:', file.size, '文件名:', file.name);

    // 获取认证令牌
    const result = await chrome.storage.local.get(['access_token']);
    const token = result.access_token;

    if (!token) {
      status.textContent = '未登录，请先登录';
      throw new Error('未登录，请先登录');
    }

    // 直接发送请求到服务器
    const formData = new FormData();
    formData.append('file', file);
    formData.append('deliveryChannel', '猎聘');
    const jobTitle = document.querySelector('.ant-im-btn-link span')?.textContent?.trim() || '未知岗位';
    formData.append('deliveryPosition', jobTitle);
    console.log('发送请求到服务器，职位:', jobTitle);

    console.log('发送请求到服务器...');
    const response = await fetch(`${envConfig.API_BASE_URL}/resume/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      credentials: 'include',
      mode: 'cors',
      body: formData
    });

    console.log('服务器响应状态:', response.status);
    const responseData = await response.json();
    console.log('服务器响应:', responseData);

    if (response.ok) {
      status.textContent = '入库成功！';
      return true;
    } else {
      // 处理服务器返回的错误信息
      status.textContent = '入库失败!';
      throw new Error(responseData.message || '入库失败');
    }
  } catch (error) {
    console.error('上传请求失败:', error);
    status.textContent = '入库失败!';
    throw error;
  }
};

// 检查元素是否包含在线简历
const hasOnlineResume = (element: Element): boolean => {
  return !!element.querySelector('.content--dw5Ml');
};

// 监听页面变化，查找下载链接和在线简历
const observePage = async () => {
  console.log('开始监听页面变化')
  
  // 创建两个浮窗 - 在线简历和附件简历
  const onlineResumeWindow = await createFloatingWindow('推鲤 AI 快聘 - 在线简历', '在线简历入库', 'bottom')
  const attachmentResumeWindow = await createFloatingWindow('推鲤 AI 快聘 - 附件简历', '附件简历入库', 'top')
  
  // 检查目标容器是否存在并处理浮窗
  const handleTargetContainer = async () => {
    try {
      console.log('等待目标容器加载...')
      const targetContainer = await waitForTargetContainer()
      console.log('目标容器加载完成，开始处理')
      
      targetContainer.style.position = 'relative'
      
      // 移除已存在的浮窗
      if (onlineResumeWindow.window.parentElement) {
        onlineResumeWindow.window.parentElement.removeChild(onlineResumeWindow.window)
      }
      if (attachmentResumeWindow.window.parentElement) {
        attachmentResumeWindow.window.parentElement.removeChild(attachmentResumeWindow.window)
      }
      
      // 添加浮窗到容器
      targetContainer.appendChild(onlineResumeWindow.window)
      targetContainer.appendChild(attachmentResumeWindow.window)
      console.log('浮窗已添加到目标容器')
      
      // 等待一小段时间确保DOM完全渲染
      setTimeout(() => {
        // 检查在线简历
        const onlineResume = document.querySelector('.content--dw5Ml');
        console.log('在线简历元素:', !!onlineResume);
        
        // 显示/隐藏在线简历浮窗
        if (onlineResume) {
          console.log('找到在线简历，显示在线简历浮窗');
          onlineResumeWindow.window.style.display = 'block';
          
          // 为在线简历按钮添加点击事件
          if (!onlineResumeWindow.uploadButton.hasAttribute('data-has-listener')) {
            onlineResumeWindow.uploadButton.setAttribute('data-has-listener', 'true');
            onlineResumeWindow.uploadButton.addEventListener('click', async (event) => {
              event.preventDefault();
              event.stopPropagation();
              
              // 设置处理中标志
              onlineResumeWindow.window.setAttribute('data-processing', 'true');
              
              // 禁用按钮
              onlineResumeWindow.uploadButton.disabled = true;
              onlineResumeWindow.uploadButton.style.opacity = '0.6';
              onlineResumeWindow.uploadButton.style.cursor = 'not-allowed';
              
              // 处理在线简历
              try {
                onlineResumeWindow.status.textContent = '正在处理在线简历...';
                const resumeFile = await convertOnlineResumeToFile(onlineResumeWindow.status);
                if (resumeFile) {
                  const success = await handleOnlineResumeUpload(resumeFile, onlineResumeWindow.status);
                  if (success) {
                    onlineResumeWindow.status.textContent = '入库成功！';
                    createToast('在线简历入库成功！');
                  }
                }
              } catch (error) {
                console.error('在线简历处理失败:', error);
                onlineResumeWindow.status.textContent = '入库失败!';
                createToast(`在线简历入库失败：${error.message}`);
              } finally {
                // 延迟恢复按钮状态和清除状态文本
                setTimeout(() => {
                  onlineResumeWindow.uploadButton.disabled = false;
                  onlineResumeWindow.uploadButton.style.opacity = '1';
                  onlineResumeWindow.uploadButton.style.cursor = 'pointer';
                  onlineResumeWindow.window.setAttribute('data-processing', 'false');
                  // 清空状态文本
                  onlineResumeWindow.status.textContent = '';
                }, 3000);
              }
            }, true);
          }
        } else {
          onlineResumeWindow.window.style.display = 'none';
        }
        
        // 检查附件简历
        const allDownloadLinks = document.querySelectorAll('a.download--SCDVl');
        console.log('找到下载链接数量:', allDownloadLinks.length);
        
        // 检查附件简历并处理
        if (allDownloadLinks.length > 0) {
          // 显示附件简历浮窗，并设置点击处理
          checkAndHandlePdfLinks(
            targetContainer, 
            attachmentResumeWindow.window, 
            attachmentResumeWindow.uploadButton, 
            attachmentResumeWindow.status
          );
        } else {
          attachmentResumeWindow.window.style.display = 'none';
        }
      }, 500);
    } catch (error) {
      console.error('处理目标容器时出错:', error);
      onlineResumeWindow.window.style.display = 'none';
      attachmentResumeWindow.window.style.display = 'none';
    }
  }

  // 初始检查
  handleTargetContainer();

  // 监听 DOM 变化
  const observer = new MutationObserver((mutations) => {
    let needsCheck = false;

    for (const mutation of mutations) {
      // 检查新增或删除的节点是否影响目标容器
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            if (node.classList?.contains('ant-lpt-modal-body') || 
                node.querySelector?.('.ant-lpt-modal-body')) {
              needsCheck = true;
              console.log('检测到目标容器相关变化');
            }
          }
        });

        mutation.removedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            if (node.classList?.contains('ant-lpt-modal-body') || 
                node.querySelector?.('.ant-lpt-modal-body')) {
              needsCheck = true;
              console.log('检测到目标容器被移除');
            }
          }
        });
      }
    }

    // 如果检测到目标容器相关变化，重新处理浮窗
    if (needsCheck) {
      console.log('重新处理浮窗');
      handleTargetContainer();
    }
  });

  // 开始观察
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  console.log('MutationObserver started');
}

// 检查并处理PDF链接 - 仅用于附件简历浮窗
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

  // 如果找到PDF链接，显示浮窗
  if (foundPdfUrl && foundFileName) {
    console.log('找到PDF链接，显示浮窗，URL:', foundPdfUrl, '文件名:', foundFileName)
    floatingWindow.style.display = 'block'
    
    // 如果按钮没有监听器，添加监听器
    if (!uploadButton.hasAttribute('data-has-listener')) {
      uploadButton.setAttribute('data-has-listener', 'true')
      
      // 添加新的事件监听器
      uploadButton.addEventListener('click', async (event) => {
        console.log('附件简历按钮被点击')
        event.preventDefault()
        event.stopPropagation()
        
        // 设置处理中标志
        floatingWindow.setAttribute('data-processing', 'true')
        
        // 禁用按钮，防止重复点击
        uploadButton.disabled = true
        uploadButton.style.opacity = '0.6'
        uploadButton.style.cursor = 'not-allowed'
        
        try {
          status.textContent = '正在处理附件简历...'
          const success = await handlePdfUpload(foundPdfUrl, foundFileName, status)
          if (success) {
            status.textContent = '入库成功！'
            createToast('附件简历入库成功！')
          }
        } catch (error) {
          console.error('附件简历入库失败:', error)
          status.textContent = '入库失败!'
          createToast(`附件简历入库失败：${error.message}`)
        } finally {
          // 延迟恢复按钮状态和清除状态文本
          setTimeout(() => {
            uploadButton.disabled = false
            uploadButton.style.opacity = '1'
            uploadButton.style.cursor = 'pointer'
            floatingWindow.setAttribute('data-processing', 'false')
            // 清空状态文本
            status.textContent = ''
          }, 3000)
        }
      }, true)
    }
  } else {
    // 只有在不处理中时才隐藏浮窗
    if (!isProcessing) {
      console.log('未找到PDF链接，隐藏浮窗')
      floatingWindow.style.display = 'none'
    }
  }
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