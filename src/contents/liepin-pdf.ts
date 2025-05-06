/// <reference types="chrome"/>

import type { PlasmoCSConfig } from "plasmo"
import { config as envConfig } from '../config/env';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { marked } from 'marked';

export const config: PlasmoCSConfig = {
  matches: ["https://lpt.liepin.com/*"],
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

// 提取职位名称的函数
const getJobTitle = (): string => {
  let jobTitle = '未知岗位';
  
  if (window.location.href.includes('https://lpt.liepin.com/chat/im')) {
    // IM页面职位获取逻辑
    jobTitle = document.querySelector('.ant-im-btn-link span')?.textContent?.trim() || '未知岗位';
  } else if (window.location.href.includes('https://lpt.liepin.com/recommend')) {
    // 推荐页面职位获取逻辑
    jobTitle = document.querySelector('.ant-lpt-typography-ellipsis-single-line[title]')?.textContent?.trim() || '未知岗位';
  } else if (window.location.href.includes('https://lpt.liepin.com/search')) {
    // 搜索页面的职位获取逻辑
    // 首先尝试从下拉选择器中获取
    const dropdownTrigger = document.querySelector('.ant-lpt-dropdown-trigger.dropdown-button');
    if (dropdownTrigger) {
      const jobTitleElement = dropdownTrigger.querySelector('.job-title');
      if (jobTitleElement && jobTitleElement.textContent) {
        jobTitle = jobTitleElement.textContent.trim();
      }
    }
    
    // 如果上面的方法没获取到，尝试更复杂的选择器
    if (jobTitle === '未知岗位') {
      const complexSelector = '#main-container > section > section > main > div > div > div.searchBarBox--IpmLs.fixed--f1zcW > div > div > div > div > div.selectJobWrap--Kwt2i.hide--DhpnJ > div.search-page-select-jobs-wrap.wrap--v6U9j > div.ant-lpt-dropdown-trigger.dropdown-button > div';
      const jobElement = document.querySelector(complexSelector);
      if (jobElement && jobElement.textContent) {
        jobTitle = jobElement.textContent.trim();
      }
    }
    
    // 如果上面的方法都没获取到，尝试查找任何包含job-title类的元素
    if (jobTitle === '未知岗位') {
      const allJobTitles = document.querySelectorAll('.job-title');
      for (const element of allJobTitles) {
        if (element.textContent && element.textContent.trim()) {
          jobTitle = element.textContent.trim();
          break;
        }
      }
    }
  }
  
  console.log('获取到职位名称:', jobTitle);
  return jobTitle;
};

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
      // 获取职位名称
      const jobTitle = getJobTitle();
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
        
        // 如果上传成功并返回了recordId，开始轮询评估接口
        if (result.success && result.data && result.data.data.recordId) {
          status.textContent = '正在评估简历...'
          const evalResult = await pollResumeEvaluation(result.data.data.recordId, token)
          if (evalResult) {
            // 显示评估结果浮窗
            showEvaluationResultWindow(evalResult, jobTitle)
          }
        }
        
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
    // 获取职位名称
    const jobTitle = getJobTitle();
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
      console.log(responseData.data)
      console.log(responseData.data.data)
      console.log(responseData.data.data.recordId)
      
      // 如果上传成功并返回了recordId，开始轮询评估接口
      if (responseData.success && responseData.data && responseData.data.data.recordId) {
        status.textContent = '正在评估简历...';
        const evalResult = await pollResumeEvaluation(responseData.data.data.recordId, token);
        if (evalResult) {
          // 显示评估结果浮窗
          showEvaluationResultWindow(evalResult, jobTitle);
        }
      }
      
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

// 轮询简历评估接口
const pollResumeEvaluation = async (recordId: string, token: string, maxRetries = 20, maxInterval = 15000): Promise<any> => {
  console.log(`开始轮询简历评估接口，recordId: ${recordId}`);
  let retryCount = 0;
  
  return new Promise((resolve, reject) => {
    const pollInterval = setInterval(async () => {
      if (retryCount >= maxRetries) {
        clearInterval(pollInterval);
        console.log('轮询次数达到上限，停止轮询');
        resolve(null);
        return;
      }

      retryCount++;
      console.log(`轮询简历评估接口第 ${retryCount} 次`);
      
      try {
        const response = await fetch(`${envConfig.API_BASE_URL}/resume/eval?resumeId=${recordId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          mode: 'cors'
        });
        
        const result = await response.json();
        console.log('评估接口响应:', result);
        
        // 外层success表示请求成功，内层data.success表示评估完成
        if (result.success && result.data && result.data.success) {
          // 评估成功，停止轮询
          clearInterval(pollInterval);
          console.log('评估成功，停止轮询:', result);
          
          // 如果界面路由是/chat/im*, 不进行自动沟通
          if (window.location.pathname.includes('/chat/im')) {
            console.log('当前界面是/chat/im*, 不进行自动沟通');
            resolve(result.data.evalInfo);
            return;
          }
          
          // 检查推荐等级，如果是"推荐"或"强烈推荐"，自动点击"立即沟通"按钮
          if (result.data.evalInfo && result.data.evalInfo.recommendLevel) {
            const recommendLevel = result.data.evalInfo.recommendLevel;
            if (recommendLevel === "推荐" || 
              recommendLevel === "强烈推荐") {
              console.log('推荐等级符合要求，尝试自动点击"立即沟通"按钮:', recommendLevel);
              
              // 查找并点击"立即沟通"按钮
              setTimeout(() => {
                // 尝试多种选择器查找"立即沟通"按钮
                let chatButton = document.querySelector('.ant-lpt-tooltip-open button');
                
                // 如果第一种选择器没找到，尝试第二种
                if (!chatButton) {
                  chatButton = document.querySelector('button.btn--hwfgv.primary--mQh0o');
                }
                
                // 如果上面都没找到，尝试通过文本内容查找
                if (!chatButton) {
                  const allButtons = document.querySelectorAll('button');
                  for (const btn of allButtons) {
                    if (btn.textContent && btn.textContent.includes('立即沟通')) {
                      chatButton = btn;
                      break;
                    }
                  }
                }
                
                if (chatButton) {
                  console.log('找到"立即沟通"按钮，自动点击');
                  (chatButton as HTMLButtonElement).click();
                  createToast('已根据AI评估自动点击"立即沟通"按钮');
                } else {
                  console.log('未找到"立即沟通"按钮');
                }
              }, 500); // 延迟500ms确保DOM已完全加载
            } else {
              console.log('推荐等级不符合自动沟通要求:', recommendLevel);
            }
          }
          
          resolve(result.data.evalInfo);
        } else {
          // 继续轮询
          const message = result.data?.message || '评估中...';
          console.log('评估中，继续轮询:', message);
        }
      } catch (error) {
        console.error('轮询请求出错:', error);
        // 发生错误，但仍继续轮询
      }
    }, maxInterval); // 使用配置的轮询间隔
  });
};

// 安全地解析Markdown内容
function safeMarkdownParse(markdownText: string): string {
  try {
    // 配置marked选项，确保安全性
    marked.setOptions({
      gfm: true, // 支持GitHub风格Markdown
      breaks: true // 支持换行符转换为<br>
    });
    
    // 解析Markdown为HTML
    const parsedHtml = marked.parse(markdownText) as string;
    
    // 简单的HTML清理，移除潜在的危险标签和属性
    const cleanHtml = parsedHtml
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // 移除script标签
      .replace(/on\w+="[^"]*"/g, '') // 移除on*事件处理器
      .replace(/javascript:[^"']*/g, ''); // 移除javascript: URL
    
    return cleanHtml;
  } catch (error) {
    console.error('Markdown解析失败:', error);
    // 如果解析失败，以纯文本形式返回原始内容
    return markdownText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// 显示评估结果浮窗
const showEvaluationResultWindow = (evalInfo: any, jobTitle: string) => {
  console.log('显示评估结果浮窗:', evalInfo);
  
  // 移除可能已存在的评估结果浮窗
  const existingWindow = document.getElementById('resume-evaluation-window');
  if (existingWindow) {
    existingWindow.remove();
  }
  
  // 创建评估结果浮窗
  const evalWindow = document.createElement('div');
  evalWindow.id = 'resume-evaluation-window';
  evalWindow.style.cssText = `
    position: fixed;
    right: 30px;
    bottom: 20px;
    background: white;
    padding: 15px;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    z-index: 9999;
    width: 280px;
    max-width: 90vw;
    max-height: 60vh;
    overflow-y: auto;
    font-size: 14px;
    display: flex;
    flex-direction: column;
  `;
  
  // 添加标题
  const titleElement = document.createElement('div');
  titleElement.textContent = '推鲤 AI 简历评估';
  titleElement.style.cssText = `
    font-weight: bold;
    font-size: 16px;
    border-bottom: 1px solid #e0e0e0;
    padding-bottom: 8px;
    margin-bottom: 12px;
    color: #333;
    flex-shrink: 0;
  `;
  
  // 创建内容容器，允许滚动
  const contentDiv = document.createElement('div');
  contentDiv.style.cssText = `
    overflow-y: auto;
    flex: 1;
    padding-right: 5px;
  `;
  
  // 添加推荐等级
  if (evalInfo.recommendLevel) {
    const recommendLevelDiv = document.createElement('div');
    recommendLevelDiv.style.cssText = `
      margin-bottom: 10px;
      display: flex;
      align-items: center;
    `;
    
    const recommendLevelTitle = document.createElement('span');
    recommendLevelTitle.textContent = '推荐等级: ';
    recommendLevelTitle.style.cssText = `
      font-weight: bold;
      margin-right: 5px;
    `;
    
    const recommendLevelValue = document.createElement('span');
    recommendLevelValue.textContent = evalInfo.recommendLevel || '无';
    
    // 根据推荐等级设置不同的颜色
    if (evalInfo.recommendLevel.includes('强烈推荐')) {
      recommendLevelValue.style.color = '#52c41a'; // 绿色
    } else if (evalInfo.recommendLevel.includes('推荐')) {
      recommendLevelValue.style.color = '#1677ff'; // 蓝色
    } else if (evalInfo.recommendLevel.includes('不推荐')) {
      recommendLevelValue.style.color = '#ff4d4f'; // 红色
    } else if (evalInfo.recommendLevel.includes('待定')) {
      recommendLevelValue.style.color = '#faad14'; // 黄色/橙色
    }
    
    recommendLevelDiv.appendChild(recommendLevelTitle);
    recommendLevelDiv.appendChild(recommendLevelValue);
    contentDiv.appendChild(recommendLevelDiv);
  }
  
  // 添加匹配度
  if (evalInfo.matchDegree) {
    const matchDegreeDiv = document.createElement('div');
    matchDegreeDiv.style.cssText = `
      margin-bottom: 15px;
      display: flex;
      flex-direction: column;
    `;
    
    // 匹配度标签和数值
    const matchHeader = document.createElement('div');
    matchHeader.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 5px;
    `;
    
    const matchDegreeTitle = document.createElement('span');
    matchDegreeTitle.textContent = '职位匹配度:';
    matchDegreeTitle.style.cssText = `
      font-weight: bold;
    `;
    
    const matchDegreeValue = document.createElement('span');
    matchDegreeValue.textContent = evalInfo.matchDegree || '无';
    matchDegreeValue.style.cssText = `
      font-weight: bold;
    `;
    
    // 根据匹配度百分比设置颜色
    const percentage = parseInt(evalInfo.matchDegree.replace('%', '').trim(), 10);
    if (percentage >= 80) {
      matchDegreeValue.style.color = '#52c41a'; // 绿色 - 高匹配
    } else if (percentage >= 60) {
      matchDegreeValue.style.color = '#1677ff'; // 蓝色 - 中等匹配
    } else if (percentage >= 40) {
      matchDegreeValue.style.color = '#faad14'; // 黄色 - 低匹配
    } else {
      matchDegreeValue.style.color = '#ff4d4f'; // 红色 - 很低匹配
    }
    
    matchHeader.appendChild(matchDegreeTitle);
    matchHeader.appendChild(matchDegreeValue);
    matchDegreeDiv.appendChild(matchHeader);
    
    // 创建进度条
    const progressContainer = document.createElement('div');
    progressContainer.style.cssText = `
      width: 100%;
      height: 8px;
      background-color: #f0f0f0;
      border-radius: 4px;
      overflow: hidden;
    `;
    
    const progressBar = document.createElement('div');
    progressBar.style.cssText = `
      width: ${evalInfo.matchDegree};
      height: 100%;
      border-radius: 4px;
    `;
    
    // 渐变色进度条
    if (percentage >= 80) {
      progressBar.style.backgroundColor = '#52c41a';
    } else if (percentage >= 60) {
      progressBar.style.backgroundColor = '#1677ff';
    } else if (percentage >= 40) {
      progressBar.style.backgroundColor = '#faad14';
    } else {
      progressBar.style.backgroundColor = '#ff4d4f';
    }
    
    progressContainer.appendChild(progressBar);
    matchDegreeDiv.appendChild(progressContainer);
    contentDiv.appendChild(matchDegreeDiv);
  }
  
  // 添加评估结果
  if (evalInfo.evalResult) {
    const evalResultDiv = document.createElement('div');
    evalResultDiv.style.cssText = `
      margin-bottom: 12px;
    `;
    
    const evalResultTitle = document.createElement('div');
    evalResultTitle.textContent = 'AI 评估结果:';
    evalResultTitle.style.cssText = `
      font-weight: bold;
      margin-bottom: 5px;
    `;
    
    const evalResultValue = document.createElement('div');
    // 使用安全的方法解析Markdown内容
    evalResultValue.innerHTML = safeMarkdownParse(evalInfo.evalResult);
    evalResultValue.style.cssText = `
      line-height: 1.5;
      color: #666;
      background-color: #f5f5f5;
      padding: 8px;
      border-radius: 4px;
      font-size: 13px;
    `;
    
    // 添加Markdown样式
    evalResultValue.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';
    
    // 设置内部元素的样式
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      #resume-evaluation-window .markdown-content h1, 
      #resume-evaluation-window .markdown-content h2, 
      #resume-evaluation-window .markdown-content h3 {
        margin-top: 8px;
        margin-bottom: 8px;
        font-weight: 600;
        line-height: 1.25;
      }
      #resume-evaluation-window .markdown-content h1 { font-size: 16px; }
      #resume-evaluation-window .markdown-content h2 { font-size: 15px; }
      #resume-evaluation-window .markdown-content h3 { font-size: 14px; }
      #resume-evaluation-window .markdown-content p { margin: 5px 0; }
      #resume-evaluation-window .markdown-content ul, 
      #resume-evaluation-window .markdown-content ol {
        padding-left: 20px;
        margin: 5px 0;
      }
      #resume-evaluation-window .markdown-content li { margin: 3px 0; }
      #resume-evaluation-window .markdown-content strong { font-weight: 600; }
      #resume-evaluation-window .markdown-content em { font-style: italic; }
      #resume-evaluation-window .markdown-content code {
        font-family: Consolas, "Liberation Mono", Menlo, Courier, monospace;
        background-color: rgba(0,0,0,0.05);
        padding: 2px 4px;
        border-radius: 3px;
        font-size: 12px;
      }
      #resume-evaluation-window .markdown-content pre {
        background-color: rgba(0,0,0,0.05);
        padding: 8px;
        border-radius: 3px;
        overflow-x: auto;
      }
      #resume-evaluation-window .markdown-content blockquote {
        margin: 5px 0;
        padding-left: 10px;
        border-left: 3px solid #ddd;
        color: #777;
      }
      #resume-evaluation-window .markdown-content table {
        border-collapse: collapse;
        width: 100%;
        margin: 10px 0;
        font-size: 12px;
      }
      #resume-evaluation-window .markdown-content th,
      #resume-evaluation-window .markdown-content td {
        border: 1px solid #ddd;
        padding: 4px 8px;
        text-align: left;
      }
      #resume-evaluation-window .markdown-content th {
        background-color: #f0f0f0;
        font-weight: bold;
      }
      #resume-evaluation-window .markdown-content tr:nth-child(even) {
        background-color: #f9f9f9;
      }
      #resume-evaluation-window .markdown-content a {
        color: #1677ff;
        text-decoration: none;
      }
      #resume-evaluation-window .markdown-content a:hover {
        text-decoration: underline;
      }
      #resume-evaluation-window .markdown-content img {
        max-width: 100%;
        height: auto;
      }
    `;
    document.head.appendChild(styleElement);
    
    // 添加类名便于样式定位
    evalResultValue.classList.add('markdown-content');
    
    evalResultDiv.appendChild(evalResultTitle);
    evalResultDiv.appendChild(evalResultValue);
    contentDiv.appendChild(evalResultDiv);
  }
  
  // 创建关闭按钮
  const closeButton = document.createElement('button');
  closeButton.textContent = '×';
  closeButton.style.cssText = `
    position: absolute;
    top: 8px;
    right: 8px;
    background-color: transparent;
    border: none;
    font-size: 18px;
    cursor: pointer;
    color: #999;
    padding: 0;
    line-height: 1;
    z-index: 1;
  `;
  
  closeButton.addEventListener('click', () => {
    evalWindow.remove();
  });
  
  evalWindow.appendChild(titleElement);
  evalWindow.appendChild(contentDiv);
  evalWindow.appendChild(closeButton);
  
  document.body.appendChild(evalWindow);
  
  // 添加淡入动画
  evalWindow.style.opacity = '0';
  evalWindow.style.transition = 'opacity 0.3s ease-in-out';
  setTimeout(() => {
    evalWindow.style.opacity = '1';
  }, 10);
  
  // // 30秒后自动关闭
  // setTimeout(() => {
  //   if (document.body.contains(evalWindow)) {
  //     evalWindow.style.opacity = '0';
  //     setTimeout(() => {
  //       if (document.body.contains(evalWindow)) {
  //         evalWindow.remove();
  //       }
  //     }, 300);
  //   }
  // }, 30000);
};

// 确保DOM加载完成后执行
console.log('Current document readyState:', document.readyState)
if (document.readyState === 'loading') {
  console.log('Waiting for DOMContentLoaded')
  document.addEventListener('DOMContentLoaded', () => observePage())
} else {
  console.log('DOM already loaded, running observePage immediately')
  observePage()
} 