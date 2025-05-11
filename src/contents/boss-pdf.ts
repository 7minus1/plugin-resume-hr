/// <reference types="chrome"/>

import type { PlasmoCSConfig } from "plasmo"
import { config as envConfig } from '../config/env';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { marked } from 'marked';
import { createToast } from '../lib/ui-utils';

export const config: PlasmoCSConfig = {
  matches: ["https://www.zhipin.com/web/chat/*"],
  all_frames: true,
  run_at: "document_end"
}

console.log('BOSS直聘-内容脚本已加载')

// 创建浮窗UI
const createFloatingWindow = () => {
  console.log('创建浮窗')
  const floatingWindow = document.createElement('div')
  floatingWindow.style.cssText = `
    position: fixed;
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
  
  document.body.appendChild(floatingWindow)
  
  return {
    window: floatingWindow,
    uploadButton,
    status
  }
}

// 处理PDF上传
const handlePdfUpload = async (pdfUrl: string, fileName: string, jobTitle: string, status: HTMLElement) => {
  try {
    status.textContent = '正在处理...'
    console.log('开始PDF上传处理...')
    
    // 获取PDF文件内容
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000) // 30秒超时

    console.log('获取PDF文件:', pdfUrl)
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
    console.log('PDF文件已创建:', fileName, 'MIME类型:', file.type)

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
      formData.append('deliveryChannel', 'BOSS直聘')
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
        
        // 如果是在沟通界面，不进行轮询
        if (window.location.href.includes('https://www.zhipin.com/web/chat/index')) {
          console.log('当前界面是chat/index，不进行自动沟通');
        } else {
          // 如果上传成功并返回了recordId，开始轮询评估接口
          if (result.success && result.data && result.data.data && result.data.data.recordId) {
            status.textContent = '正在评估简历...'
            console.log('开始轮询评估接口，recordId:', result.data.data.recordId)
            const evalResult = await pollResumeEvaluation(result.data.data.recordId, token)
            if (evalResult) {
              // 显示评估结果浮窗
              showEvaluationResultWindow(evalResult, jobTitle)
            }
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

// 获取职位名称
const getJobTitle = (): string => {
  if (window.location.href.includes('/index')) {
    // 首先尝试从position-name类获取职位名称
    const positionNameElement = document.querySelector('.position-name');
    if (positionNameElement) {
      const positionName = positionNameElement.textContent?.trim() || '';
      console.log('从position-name获取到职位名称:', positionName);
      if (positionName) {
        return positionName;
      }
    }
    
    // 如果找不到position-name，回退到原来的方法
    const jobTitleElement = document.querySelector('.message-card-top-title')
    if (jobTitleElement) {
      const fullText = jobTitleElement.textContent || ''
      // 提取"沟通的职位-"后面的内容
      const match = fullText.match(/沟通的职位-(.+)/)
      if (match && match[1]) {
        console.log('从message-card-top-title获取到职位名称:', match[1].trim());
        return match[1].trim()
      }
    }
  } else if (window.location.href.includes('/recommend')) {
    // 对于recommend路由，使用指定的选择器获取职位名称
    // 在iframe中寻找
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      const jobSelectorElement = iframe.contentDocument.querySelector('.job-selecter-wrap .ui-dropmenu-label');
      console.log('recommend jobSelectorElement', jobSelectorElement)
      if (jobSelectorElement) {
        // 获取完整文本
        const fullText = jobSelectorElement.textContent?.trim() || '';
        console.log('从ui-dropmenu-label获取到完整文本:', fullText);
        
        // 从字符串末尾开始分割，取最后一个下划线之前的所有内容作为职位名称
        const lastUnderscoreIndex = fullText.lastIndexOf('_');
        if (lastUnderscoreIndex !== -1) {
          const jobTitle = fullText.substring(0, lastUnderscoreIndex).trim();
          console.log('从末尾分割提取的职位名称:', jobTitle);
          return jobTitle;
        }
        
        // 如果没有找到下划线，返回完整文本
        console.log('未找到下划线，返回完整文本作为职位名称');
          return fullText;
      }
    }
  } else if (window.location.href.includes('/search')) {
    // 对于search路由，使用指定的选择器获取职位名称
    // 在iframe中寻找
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      const searchJobElement = iframe.contentDocument.querySelector('.search-current-job');
      console.log('searchJobElement', searchJobElement)
      
      if (searchJobElement) {
        const jobTitle = searchJobElement.textContent?.trim() || '';
        console.log('从search-current-job获取到职位名称:', jobTitle); 
        if (jobTitle) {
          return jobTitle;
        }
      }
    }
  }
  
  console.log('未能获取到职位名称，使用默认值');
  return '未知职位'
}

// XHR请求拦截器
const setupXHRInterceptor = (callback: (url: string, responseData: any) => void) => {
  const XHR = XMLHttpRequest.prototype;
  const open = XHR.open;
  const send = XHR.send;
  const setRequestHeader = XHR.setRequestHeader;

  // 拦截 open
  XHR.open = function(this: XMLHttpRequest, method: string, url: string | URL) {
    // @ts-ignore
    this._url = url;
    // @ts-ignore
    this._method = method;
    // @ts-ignore
    return open.apply(this, arguments);
  };

  // 拦截 setRequestHeader
  XHR.setRequestHeader = function(this: XMLHttpRequest, header: string, value: string) {
    // @ts-ignore
    if (!this._headers) this._headers = {};
    // @ts-ignore
    this._headers[header] = value;
    return setRequestHeader.apply(this, arguments);
  };

  // 拦截 send
  XHR.send = function(this: XMLHttpRequest, data?: Document | XMLHttpRequestBodyInit | null) {
    // 监听响应
    this.addEventListener('load', function() {
      try {
        // @ts-ignore
        if (this._url && this._url.toString().includes('resume')) {
          try {
            const responseData = JSON.parse(this.responseText);
            // @ts-ignore
            callback(this._url.toString(), responseData);
          } catch (e) {
            console.log('无法解析响应:', e);
          }
        }
      } catch (e) {
        console.error('XHR拦截器错误:', e);
      }
    });

    // @ts-ignore
    return send.apply(this, arguments);
  };
};

// 拦截Fetch请求
const setupFetchInterceptor = (callback: (url: string, responseData: any) => void) => {
  const originalFetch = window.fetch;
  window.fetch = async function(input: RequestInfo | URL, init?: RequestInit) {
    const response = await originalFetch(input, init);
    
    try {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      
      if (url.includes('resume')) {
        // 克隆响应以便可以多次读取
        const clonedResponse = response.clone();
        try {
          const data = await clonedResponse.json();
          callback(url, data);
        } catch (e) {
          console.log('无法解析fetch响应:', e);
        }
      }
    } catch (e) {
      console.error('Fetch拦截器错误:', e);
    }
    
    return response;
  };
};

const findOnlineResumeContainer = (): HTMLElement | null => {
  // 查找简历容器
  if (window.location.pathname.includes('/index')) {
    const resumeContainer = document.querySelector('.resume-box') as HTMLElement;
    if (!resumeContainer) {
      return null;
    }
    return resumeContainer;
  } else if (window.location.pathname.includes('/recommend')) {
    // 检查iframe中的.resume-detail-wrap元素
    let resumeContainer = null;
    const iframesForResume = document.querySelectorAll('iframe');
    iframesForResume.forEach((iframe, index) => {
      try {
        if (iframe.contentDocument) {
          const resumeDetailWrap = iframe.contentDocument.querySelector('.resume-detail-wrap');
          if (resumeDetailWrap) {
            console.log(`在iframe ${index}中找到.resume-detail-wrap元素`);
            resumeContainer = resumeDetailWrap as HTMLElement;
          }
        }
      } catch (e) {
        // 跨域错误，忽略
      }
    });
    // 如果找不到iframe中的.resume-detail-wrap元素
    // 继续找 类名为lib-standard-resume的元素
    if (!resumeContainer) {
      const libStandardResume = document.querySelector('.lib-standard-resume') as HTMLElement;
      if (libStandardResume) {
        console.log('找到.lib-standard-resume元素');
        resumeContainer = libStandardResume;
      }
    }
    return resumeContainer;
  } else if (window.location.pathname.includes('/search')) {
    const resumeContainer = document.querySelector('.resume-detail-wrap') as HTMLElement;
    if (!resumeContainer) {
      return null;
    }
    return resumeContainer;
  }
}

// 将在线简历转换为PDF文件
const convertOnlineResumeToFile = async (status: HTMLElement): Promise<File | null> => {
  try {
    console.log('开始转换在线简历为PDF');
    status.textContent = '正在处理在线简历...';
    
    const resumeContainer = findOnlineResumeContainer();
    if (!resumeContainer) {
      console.error('找不到简历容器');
      status.textContent = '找不到简历内容';
      return null;
    }
    
    try {
      status.textContent = '正在生成PDF...';
      
      // 创建测试PDF并返回
      console.log("生成包含简历内容的测试PDF");
      
      const testPdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      // 尝试将HTML渲染到PDF
      try {
        console.log('尝试使用html2canvas渲染简历容器');
        status.textContent = '正在渲染简历...';

        // 记录要渲染的元素
        const infoSection = resumeContainer;
        console.log('准备渲染的元素:', infoSection);
        
        // 渲染前记录元素尺寸和位置
        const rect = infoSection.getBoundingClientRect();
        console.log('元素尺寸:', { 
          width: rect.width, 
          height: rect.height,
          visibleOnScreen: rect.top < window.innerHeight && rect.bottom > 0
        });
        
        // // 预处理处理图片，防止canvas被污染
        // const images = infoSection.querySelectorAll('img');
        // console.log(`找到${images.length}个图片元素`);
        
        // // 为所有图片添加crossorigin属性
        // images.forEach(img => {
        //   if (!img.hasAttribute('crossorigin')) {
        //     img.setAttribute('crossorigin', 'anonymous');
        //     console.log('为图片添加crossorigin属性:', img.src);
        //   }
        // });
        
        // 使用更多选项提高渲染成功率
        const canvas = await html2canvas(infoSection as HTMLElement, {
          scale: 2, // 提高缩放比例以提高质量
          logging: true, // 开启日志
          useCORS: true, // 允许跨域图像
          allowTaint: false, // 不允许污染canvas，防止toDataURL错误
          imageTimeout: 15000, // 增加图片加载超时时间
          // removeContainer: true, // 移除临时创建的容器
          // ignoreElements: (element) => {
          //   // 忽略可能导致跨域问题的元素
          //   if (element.tagName === 'IMG' && !element.hasAttribute('crossorigin')) {
          //     console.log('忽略没有crossorigin属性的图片:', element);
          //     return true;
          //   }
          //   return false;
          // },
          backgroundColor: '#ffffff', // 白色背景
          windowWidth: window.innerWidth,
          windowHeight: window.innerHeight,
          scrollX: 0, // 不使用window.scrollX
          scrollY: 0, // 不使用window.scrollY
          x: 0, // 从元素的左边缘开始
          y: 0, // 从元素的上边缘开始
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
          testPdf.addImage(imgData, 'JPEG', margin, margin, contentWidth, scaledHeight);
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
              canvas.width, currentPageHeight, // a源图像的宽度和高度
              0, 0,                        // 目标canvas的起始坐标
              canvas.width, currentPageHeight  // 目标canvas的宽度和高度
            );
            
            // 将临时canvas转为图像并添加到PDF
            const pageImgData = tempCanvas.toDataURL('image/jpeg', 0.9);
            
            // 添加图像到PDF
            testPdf.addImage(
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
              testPdf.addPage();
            }
          }
        }
        
      } catch (renderError) {
        console.error('html2canvas渲染失败:', renderError);
        
        // 记录详细错误信息
        console.error('错误详情:', {
          message: renderError.message,
          stack: renderError.stack,
          name: renderError.name
        });
        
        // 如果渲染失败，尝试创建文本版PDF
        console.log('尝试创建文本版PDF作为备用');
        
        // 提取文本内容
        const textContent = extractTextContent(resumeContainer);
        
        // 创建新PDF
        const textPdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        });
        
        // 设置PDF属性
        const pageWidth = 210;
        const margin = 10;
        const contentWidth = pageWidth - 2 * margin;
        
        // 添加标题
        textPdf.setFontSize(16);
        textPdf.text('简历内容 (文本版)', margin, margin + 10);
        
        // 添加普通文本
        textPdf.setFontSize(12);
        const splitText = textPdf.splitTextToSize(textContent, contentWidth);
        textPdf.text(splitText, margin, margin + 20);
        
        // 转换成文件
        const pdfBlob = textPdf.output('blob');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `简历文本版_${timestamp}.pdf`;
        
        const file = new File([pdfBlob], fileName, {
          type: 'application/pdf',
          lastModified: new Date().getTime()
        });
        
        console.log(`成功创建文本版PDF文件: ${fileName}, 大小: ${file.size} 字节`);
        status.textContent = '文本版PDF生成成功';
        return file;
      }
      
      // 转换成文件
      const pdfBlob = testPdf.output('blob');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `$测试PDF_${timestamp}.pdf`;
      
      const file = new File([pdfBlob], fileName, {
        type: 'application/pdf',
        lastModified: new Date().getTime()
      });
      
      console.log(`成功创建测试PDF文件: ${fileName}, 大小: ${file.size} 字节`);
      status.textContent = '测试PDF生成成功';
      return file;
      
    } catch (importError) {
      console.error('使用jsPDF或html2canvas失败:', importError);
      status.textContent = '生成PDF失败';
      
      // 创建错误报告PDF
      return null;
    }
    
  } catch (error) {
    console.error('转换在线简历时出错:', error);
    status.textContent = '处理简历失败';
    
    return null;
  }
};

// 提取元素中的文本内容
function extractTextContent(element: HTMLElement): string {
  // 创建一个克隆，避免修改原始元素
  const clone = element.cloneNode(true) as HTMLElement;
  
  // 移除所有脚本和样式元素
  const scriptsAndStyles = clone.querySelectorAll('script, style');
  scriptsAndStyles.forEach(el => el.remove());
  
  // 将换行符和制表符转换为空格
  let text = clone.innerText || clone.textContent || '';
  
  // 清理文本
  text = text.replace(/[\t\n]+/g, '\n')  // 将多个制表符和换行符替换为单个换行符
             .replace(/\s{2,}/g, ' ')    // 将多个空格替换为单个空格
             .trim();                    // 移除首尾空格
  
  return text;
}

// 辅助函数：将Data URL转换为Blob
function dataURLtoBlob(dataurl: string): Blob {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

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
    formData.append('deliveryChannel', 'BOSS直聘');
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
      
      // 如果上传成功并返回了recordId，开始轮询评估接口
      if (responseData.success && responseData.data && responseData.data.data && responseData.data.data.recordId) {
        status.textContent = '正在评估简历...';
        console.log('开始轮询评估接口，recordId:', responseData.data.data.recordId);
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

// 主要逻辑
const main = async () => {
  console.log('开始执行主要逻辑')
  const { window: floatingWindow, uploadButton, status } = createFloatingWindow()
  let pdfUrl = ''
  let filename = 'resume.pdf'
  let jobTitle = '未知职位'
  let isProcessing = false

  // 存储简历类型
  let resumeType = 'unknown'; // 'online'表示在线简历, 'attachment'表示附件简历, 'unknown'表示未知

  // 存储捕获到的PDF URL
  let capturedPdfUrl = '';

  // 函数：检测当前显示的简历类型
  const detectResumeType = () => {
    // 检查是否有PDF查看器元素
    const pdfViewerElements = [
      document.querySelector('#viewer.pdfViewer'),
      document.querySelector('.pdfViewer'),
      document.querySelector('#viewer'),
      document.querySelector('div#viewer.pdfViewer'),
      document.querySelector('div.pdfViewer > div.page')
    ];
    
    // 检查是否有在线简历元素
    const onlineResumeElements = [
      document.querySelector('.resume-detail'),
      document.querySelector('.resume-content'),
      document.querySelector('.resume-detail-chat'),
      document.querySelector('.resume-detail-wrap'),   // 路由 /recommend 下的在线简历
      document.querySelector('.resume-center-side'),   // 路由 /recommend 下的在线简历
      document.querySelector('.resume-middle-wrap'),   // 路由 /recommend 下的在线简历
      document.querySelector('.resume-layout-wrap'),   // 路由 /recommend 下的在线简历
      document.querySelector('.resume-inner-left'),   // 路由 /recommend 下的在线简历
      document.querySelector('.lib-standard-resume')   // 路由 /recommend 下的在线简历
    ];
    
    // 额外检查iframe中的.resume-detail-wrap元素
    const iframesForResume = document.querySelectorAll('iframe');
    iframesForResume.forEach((iframe, index) => {
      try {
        if (iframe.contentDocument) {
          const resumeDetailWrap = iframe.contentDocument.querySelector('.resume-detail-wrap');
          if (resumeDetailWrap) {
            console.log(`在iframe ${index}中找到.resume-detail-wrap元素`);
            onlineResumeElements.push(resumeDetailWrap);
          }
        }
      } catch (e) {
        // 跨域错误，忽略
      }
    });
    
    console.log(onlineResumeElements)
    console.log('PDF查看器元素检测结果:', pdfViewerElements.map(el => !!el));
    console.log('在线简历元素检测结果:', onlineResumeElements.map(el => !!el));
    
    // 首先查找iframe中的PDF查看器
    const iframes = document.querySelectorAll('iframe');
    let hasPdfInIframe = false;
    
    iframes.forEach((iframe, index) => {
      try {
        if (iframe.contentDocument) {
          const pdfInIframe = iframe.contentDocument.querySelector('#viewer.pdfViewer, .pdfViewer, #viewer');
          if (pdfInIframe) {
            console.log(`在iframe ${index}中找到PDF查看器`);
            hasPdfInIframe = true;
          }
        }
      } catch (e) {
        // 跨域错误，忽略
      }
    });
    
    // 确定简历类型
    if (pdfViewerElements.some(el => !!el) || hasPdfInIframe) {
      console.log('检测到附件简历 (PDF查看器)');
      resumeType = 'attachment';
      return 'attachment';
    } else if (onlineResumeElements.some(el => !!el)) {
      console.log('检测到在线简历');
      resumeType = 'online';
      return 'online';
    } else {
      console.log('无法确定简历类型，默认为未知');
      resumeType = 'unknown';
      return 'unknown';
    }
  };

  // 设置网络请求拦截器
  setupXHRInterceptor((url, data) => {
    if (data && data.zpData && data.zpData.url) {
      console.log('XHR拦截器捕获PDF URL:', data.zpData.url);
      capturedPdfUrl = data.zpData.url;
    }
  });

  setupFetchInterceptor((url, data) => {
    if (data && data.zpData && data.zpData.url) {
      console.log('Fetch拦截器捕获PDF URL:', data.zpData.url);
      capturedPdfUrl = data.zpData.url;
    }
  });

  // 从iframe中获取PDF URL
  const getPdfUrlFromIframe = () => {
    const iframes = document.querySelectorAll('iframe.attachment-iframe, iframe.attachment-box');
    console.log('找到简历iframe数量:', iframes.length);
    
    if (iframes.length > 0) {
      for (const iframe of iframes) {
        const src = iframe.getAttribute('src');
        if (src) {
          console.log('获取到iframe src:', src);
          
          // 检查iframe源是否包含PDF查看器路径
          if (src.includes('pdfjs/web/viewer.html')) {
            // 提取file参数的值，这通常是要展示的PDF文件的URL
            const fileMatch = src.match(/[?&]file=([^&]+)/);
            if (fileMatch && fileMatch[1]) {
              // 解码URL编码的文件路径
              const pdfPath = decodeURIComponent(fileMatch[1]);
              console.log('从iframe提取的PDF路径:', pdfPath);
              
              // 构建完整的PDF URL
              const fullPdfUrl = pdfPath.startsWith('http') ? pdfPath : 
                                 (window.location.origin + (pdfPath.startsWith('/') ? '' : '/') + pdfPath);
              console.log('构建的完整PDF URL:', fullPdfUrl);
              
              return {
                url: fullPdfUrl,
                name: `简历_${jobTitle}_${new Date().getTime()}.pdf`
              };
            }
          }
        }
      }
    }
    return null;
  };

  // 触发下载按钮点击以获取PDF URL
  const triggerDownloadButtonClick = () => {
    const downloadButtons = document.querySelectorAll('.attachment-resume-btns .popover.icon-content.popover-bottom');
    let downloadButton = null;
    
    // 查找下载按钮
    downloadButtons.forEach(button => {
      const popoverContent = button.querySelector('.popover-content');
      if (popoverContent && popoverContent.textContent?.trim() === '下载') {
        console.log('找到下载按钮，准备模拟点击');
        downloadButton = button;
      }
    });
    
    if (downloadButton) {
      const span = downloadButton.querySelector('span');
      if (span) {
        console.log('模拟点击下载按钮');
        (span as HTMLElement).click();
        return true;
      }
    }
    
    // 如果找不到匹配的下载按钮，尝试查找包含下载图标的元素
    const downloadIcons = document.querySelectorAll('svg[data-v-4818b1bc][aria-hidden="true"]');
    for (const icon of downloadIcons) {
      const use = icon.querySelector('use');
      if (use && use.getAttribute('xlink:href')?.includes('download')) {
        console.log('找到下载图标，准备模拟点击');
        (icon as HTMLElement).click();
        return true;
      }
    }
    
    return false;
  };

  // 自动下载和上传PDF
  const autoDownloadAndUpload = async () => {
    console.log('尝试自动下载并上传PDF');
    
    // 重置capturedPdfUrl
    capturedPdfUrl = '';
    
    // 首先尝试从iframe获取PDF URL
    const pdfInfo = getPdfUrlFromIframe();
    if (pdfInfo) {
      console.log('从iframe获取到PDF URL:', pdfInfo.url);
      pdfUrl = pdfInfo.url;
      filename = pdfInfo.name;
      return true;
    }
    
    // 如果从iframe无法获取，尝试点击下载按钮
    console.log('无法从iframe获取PDF URL，尝试模拟点击下载按钮');
    
    // 尝试点击下载按钮并等待URL捕获
    let clickSuccess = triggerDownloadButtonClick();
    if (clickSuccess) {
      console.log('成功触发下载按钮点击，等待URL捕获');
      
      // 等待捕获URL (最多等待5秒)
      let attempts = 0;
      const maxAttempts = 10;
      
      return new Promise(resolve => {
        const checkInterval = setInterval(() => {
          attempts++;
          if (capturedPdfUrl) {
            clearInterval(checkInterval);
            console.log('成功捕获PDF URL:', capturedPdfUrl);
            pdfUrl = capturedPdfUrl;
            filename = `简历_${jobTitle}_${new Date().getTime()}.pdf`;
            resolve(true);
          } else if (attempts >= maxAttempts) {
            clearInterval(checkInterval);
            console.log('等待PDF URL捕获超时');
            resolve(false);
          }
        }, 500);
      });
    }
    
    // 如果无法点击下载按钮，寻找页面上所有可能是PDF内容的元素
    console.log('无法找到或点击下载按钮，检查页面中所有可能的PDF内容元素');
    
    // 查找所有canvas元素，尝试提取PDF内容
    const canvasElements = document.querySelectorAll('canvas');
    if (canvasElements.length > 0) {
      console.log('发现canvas元素，可能可以从中提取PDF数据，但需要用户手动点击下载');
      createToast('请点击下载按钮获取简历');
      return false;
    }
    
    // 在页面上搜索可能包含PDF URL的元素
    const allElements = document.querySelectorAll('*');
    for (const el of allElements) {
      try {
        // 检查元素属性
        for (const attr of ['src', 'href', 'data-url', 'data-src', 'data-href']) {
          const attrValue = el.getAttribute(attr);
          if (attrValue && (attrValue.includes('.pdf') || attrValue.includes('pdf='))) {
            console.log(`在元素属性${attr}中找到可能的PDF URL:`, attrValue);
            pdfUrl = attrValue;
            filename = `简历_${jobTitle}_${new Date().getTime()}.pdf`;
            return true;
          }
        }
      } catch (e) {
        // 忽略错误
      }
    }
    
    console.log('无法自动获取PDF URL，请用户手动点击下载按钮');
    return false;
  };

  // 进行多次检查，有时DOM可能需要时间加载
  const performMultipleChecks = () => {
    console.log('开始执行多次检查');
    // 立即检查
    // 直接显示浮窗，无需检测简历类型
      floatingWindow.style.display = 'block';
      
      // 获取职位信息
      jobTitle = getJobTitle();
      console.log('当前职位:', jobTitle);
    
    // 然后在500ms, 1000ms, 2000ms, 5000ms后再次检查
    const checkTimes = [500, 1000, 2000, 5000];
    checkTimes.forEach(time => {
      setTimeout(() => {
        console.log(`${time}ms后再次检查`);
        // 更新职位信息
        jobTitle = getJobTitle();
        console.log(`${time}ms后更新职位:`, jobTitle);
      }, time);
    });
  };

  // 监听页面变化
  const observer = new MutationObserver((mutations) => {
    console.log('检测到DOM变化，更新职位信息');
    // 更新职位信息
    jobTitle = getJobTitle();
    console.log('DOM变化后的职位:', jobTitle);
  });

  // 监听整个文档的变化，以及子元素的变化
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'id']
  });

  // 初始检查
  performMultipleChecks();
  
  // 上传按钮点击事件
  uploadButton.addEventListener('click', async () => {
    if (isProcessing) return;
    
    console.log('上传按钮被点击');
    setIsProcessing(true);
    
    // 延迟一小段时间再检测简历类型，确保DOM已完全加载
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // 重新检测简历类型
    const currentResumeType = detectResumeType();
    console.log('当前简历类型:', currentResumeType);
    
    // 根据简历类型决定处理逻辑
    if (currentResumeType === 'attachment') {
      // 处理附件简历
      console.log('处理附件简历，尝试获取PDF文件');
      createToast('正在获取附件简历...');
      
      // 调用自动下载函数获取PDF URL
      await autoDownloadAndUpload();
      
      // 等待一段时间再检查是否获取到了URL
      setTimeout(async () => {
        if (capturedPdfUrl || pdfUrl) {
          console.log('成功获取到PDF URL，开始上传');
          await performUpload();
        } else {
          createToast('无法获取附件简历，请手动点击下载按钮');
          setIsProcessing(false);
        }
      }, 2000); // 增加等待时间，确保有足够时间捕获URL
    } else if (currentResumeType === 'online') {
      // 处理在线简历
      console.log('处理在线简历，开始转换为PDF');
      createToast('正在处理在线简历...');
      
      try {
        // 将在线简历转换为PDF文件
        const resumeFile = await convertOnlineResumeToFile(status);
        
        if (resumeFile) {
          // 上传处理后的简历文件
          const success = await handleOnlineResumeUpload(resumeFile, status);
          
          if (success) {
            createToast('入库成功！');
          }
        } else {
          createToast('无法处理在线简历，请确保简历内容已完全加载');
        }
      } catch (error) {
        console.error('处理在线简历失败:', error);
        createToast(`入库失败：${error.message}`);
      } finally {
        // 延迟恢复按钮状态
        setTimeout(() => {
          setIsProcessing(false);
        }, 3000);
      }
    } else {
      // 未检测到简历
      console.log('未检测到简历内容');
      createToast('未找到简历内容，请确保简历已打开');
      setIsProcessing(false);
    }
  });
  
  // 设置处理状态
  const setIsProcessing = (state: boolean) => {
    isProcessing = state;
    uploadButton.disabled = state;
    uploadButton.style.opacity = state ? '0.6' : '1';
    uploadButton.style.cursor = state ? 'not-allowed' : 'pointer';
    if (!state) {
      status.textContent = '';
    }
  }

  // 执行上传操作
  const performUpload = async () => {
    if (pdfUrl === 'auto-extract') {
      console.log('尝试从页面自动提取PDF');
      
      // 尝试从canvas元素提取PDF
      const canvasElements = document.querySelectorAll('canvas');
      if (canvasElements.length > 0) {
        try {
          console.log('尝试从canvas元素生成PDF');
          createToast('正在尝试从页面生成PDF...');
          
          // 这里我们只是模拟，实际上无法执行
          createToast('无法自动生成PDF，请先点击下载按钮');
          return;
        } catch (error) {
          console.error('从canvas提取PDF失败:', error);
          createToast('无法从页面生成PDF，请先点击下载按钮');
          return;
        }
      } else {
        createToast('请先点击下载按钮获取简历');
        return;
      }
    }
    
    // 使用捕获到的URL或备用URL
    const finalPdfUrl = capturedPdfUrl || pdfUrl;
    
    try {
      const success = await handlePdfUpload(finalPdfUrl, filename, jobTitle, status);
      if (success) {
        createToast('入库成功！');
      }
    } catch (error) {
      console.error('入库失败:', error);
      createToast(`入库失败：${error.message}`);
    } finally {
      // 延迟恢复按钮状态
      setTimeout(() => {
        setIsProcessing(false);
      }, 3000);
    }
  };
}

// 确保尽早开始监听
console.log('BOSS直聘 - 初始化脚本');
if (document.readyState === 'loading') {
  console.log('等待DOMContentLoaded');
  // 在DOMContentLoaded时执行main
  document.addEventListener('DOMContentLoaded', main);
} else {
  console.log('DOM已加载，立即执行main');
  main();
}

// 添加额外的加载检查，确保浮窗显示
window.addEventListener('load', () => {
  console.log('window.load事件触发，确保简历已被检测');
  
  // 确保浮窗显示
  console.log('window.load事件触发，确保浮窗显示');
  const floatingWindows = document.querySelectorAll('div[style*="position: fixed"]');
  if (floatingWindows.length === 0) {
    console.log('未检测到已有浮窗，重新运行main');
    main();
  } else {
    console.log('已检测到浮窗，无需重新运行main');
  }
});

// 寻找打招呼按钮
const findGreetButton = () => {
  if (window.location.pathname.includes('/search')) {
    console.log('在search页面寻找打招呼按钮')
    const greetButton = document.querySelector(".boss-dialog__body .prop-card-chat");
    return greetButton;
    // // 在iframe中寻找
    // const iframes = document.querySelectorAll('iframe');
    // for (const iframe of iframes) {
    //   const greetButton = iframe.contentDocument.querySelector('.prop-card-chat');
    //   if (greetButton) {
    //     return greetButton;
    //   }
    // }
  } else if (window.location.pathname.includes('/recommend')) {
    console.log('在recommend页面寻找打招呼按钮')
    // const greetButton = document.querySelector(".boss-dialog__body .btn-v2.btn-sure-v2.btn-greet");
    // return greetButton;
    // 在iframe中寻找
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      const greetButton = iframe.contentDocument.querySelector('.btn-sure-v2.btn-greet');
      if (greetButton) {
        return greetButton;
      }
    }
  }
  return null;
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
          
          // 如果界面路由包含"https://www.zhipin.com/web/chat/index"，不进行自动沟通
          if (window.location.href.includes('https://www.zhipin.com/web/chat/index')) {
            console.log('当前界面是chat/index，不进行自动沟通');
            resolve(result.data.evalInfo);
            return;
          }
          
          // 检查推荐等级，如果是"推荐"或"强烈推荐"，自动点击"打招呼"按钮
          if (result.data.evalInfo && result.data.evalInfo.recommendLevel) {
            const recommendLevel = result.data.evalInfo.recommendLevel;
            if (recommendLevel === "推荐" || recommendLevel === "强烈推荐") {
              console.log('推荐等级符合要求，尝试自动点击"打招呼"按钮:', recommendLevel);
              
              // 查找并点击"打招呼"按钮
              setTimeout(() => {
                const greetButton = findGreetButton();
                
                if (greetButton) {
                  console.log('找到"打招呼"按钮，自动点击');
                  console.log('自动点击的按钮 greetButton', greetButton);
                  // TODO 复原
                  (greetButton as HTMLButtonElement).click();
                  createToast('已根据AI评估自动点击"打招呼"按钮');
                } else {
                  console.log('未找到"打招呼"按钮');
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
}; 