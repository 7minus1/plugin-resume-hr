/// <reference types="chrome"/>

import type { PlasmoCSConfig } from "plasmo"
import { config as envConfig } from '../config/env';

export const config: PlasmoCSConfig = {
  matches: ["https://www.zhipin.com/web/chat/index*"],
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

// 获取职位信息
const getJobTitle = (): string => {
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

// 主要逻辑
const main = async () => {
  console.log('开始执行主要逻辑')
  const { window: floatingWindow, uploadButton, status } = createFloatingWindow()
  let pdfUrl = ''
  let filename = 'resume.pdf'
  let jobTitle = '未知职位'
  let isProcessing = false

  // 存储捕获到的PDF URL
  let capturedPdfUrl = '';

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
    
    // 首先尝试从iframe获取PDF URL
    const pdfInfo = getPdfUrlFromIframe();
    if (pdfInfo) {
      console.log('从iframe获取到PDF URL:', pdfInfo.url);
      pdfUrl = pdfInfo.url;
      filename = pdfInfo.name;
      // createToast('已获取简历，可以点击"简历入库"按钮上传');
      return;
    }
    
    // 如果从iframe无法获取，尝试点击下载按钮
    console.log('无法从iframe获取PDF URL，尝试模拟点击下载按钮');
    if (triggerDownloadButtonClick()) {
      // 等待一段时间，让拦截器有机会捕获URL
      setTimeout(() => {
        if (capturedPdfUrl) {
          console.log('通过模拟点击捕获到PDF URL:', capturedPdfUrl);
          pdfUrl = capturedPdfUrl;
          filename = `简历_${jobTitle}_${new Date().getTime()}.pdf`;
          // createToast('已获取简历，可以点击"简历入库"按钮上传');
        } else {
          console.log('模拟点击后未能捕获PDF URL');
          createToast('无法自动获取PDF，请手动点击下载按钮');
        }
      }, 1000);
    } else {
      console.log('未找到可点击的下载按钮');
    }
  };

  // 检查PDF查看器是否存在，若存在则显示浮窗
  const checkPdfViewer = () => {
    // 添加调试日志
    console.log('正在检查PDF查看器元素...');

    // 检查是否有简历容器元素
    const resumeContainer = document.querySelector('.resume-detail, .resume-content, .resume-detail-chat');
    if (resumeContainer) {
      console.log('找到简历容器，显示浮窗');
      floatingWindow.style.display = 'block';
      
      // 获取职位信息
      jobTitle = getJobTitle();
      console.log('当前职位:', jobTitle);
      
      // 移除自动下载调用
      // setTimeout(autoDownloadAndUpload, 1000);
      return;
    }
    
    // 尝试多种选择器
    const pdfViewer = 
      document.querySelector('.pdfViewer') || 
      document.querySelector('#viewer.pdfViewer') ||
      document.querySelector('[class*="pdfViewer"]') ||
      document.querySelector('[id="viewer"]') ||
      // 新增针对具体提供的HTML结构的选择器
      document.querySelector('#viewer[class="pdfViewer"]') ||
      document.querySelector('div#viewer.pdfViewer') ||
      document.querySelector('div.pdfViewer > div.page[data-page-number="1"]') ||
      document.querySelector('div.pdfViewer > div.page > div.canvasWrapper > canvas');
    
    // 输出找到的元素以进行调试
    console.log('PDF查看器元素:', pdfViewer);
    
    // 查找页面中包含"pdf"或"简历"的所有元素，以排查可能的选择器
    const possiblePdfElements = document.querySelectorAll('*[class*="pdf"], *[id*="pdf"], *[class*="resume"], *[id*="resume"]');
    console.log('可能的PDF相关元素:', possiblePdfElements);
    
    if (pdfViewer) {
      console.log('找到PDF查看器，显示浮窗');
      floatingWindow.style.display = 'block';
      
      // 获取职位信息
      jobTitle = getJobTitle();
      console.log('当前职位:', jobTitle);
      
      // 移除自动下载调用
      // setTimeout(autoDownloadAndUpload, 1000);
      
      // 查找所有可能的下载按钮
      console.log('开始查找各种可能的下载按钮...');
      
      // 直接查找指定的下载按钮
      const downloadButtons = document.querySelectorAll('.attachment-resume-btns .popover.icon-content.popover-bottom');
      console.log('找到指定结构的下载按钮数量:', downloadButtons.length);
      
      // 查找任何包含"下载"文本的元素
      const textDownloadButtons = Array.from(document.querySelectorAll('*'))
        .filter(el => 
          el.textContent && 
          el.textContent.includes('下载') && 
          el.textContent.length < 20 && // 避免选中包含大段文本的元素
          !el.hasAttribute('data-intercepted')
        );
      console.log('包含"下载"文本的按钮数量:', textDownloadButtons.length);
      
      // 查找任何可能是下载按钮的元素
      const allPossibleDownloadButtons = [
        ...Array.from(document.querySelectorAll('[class*="download"], [id*="download"], [aria-label*="下载"]')),
        ...Array.from(document.querySelectorAll('svg[data-icon="download"], button[title*="下载"], a[title*="下载"]')),
        ...Array.from(document.querySelectorAll('[class*="attach"], [id*="attach"], [class*="resume-action"]')),
        ...Array.from(document.querySelectorAll('[class*="pdf-action"], [class*="pdf-tool"], [class*="tool-item"]'))
      ].filter(el => !el.hasAttribute('data-intercepted'));
      
      console.log('所有可能的下载按钮元素数量:', allPossibleDownloadButtons.length);
      
      // 如果没有找到下载按钮，创建我们自己的下载按钮
      if (downloadButtons.length === 0 && textDownloadButtons.length === 0 && allPossibleDownloadButtons.length === 0) {
        console.log('未找到任何下载按钮，准备自动尝试获取PDF');
        
        // 假设如果有PDF查看器，那么PDF URL应该可以从某处获取
        // 我们将设置一个标志，表示当用户点击上传按钮时，尝试从页面提取PDF数据
        pdfUrl = 'auto-extract';
        
        // 尝试从canvas元素中提取PDF数据
        const canvasElements = document.querySelectorAll('canvas');
        console.log('找到canvas元素数量:', canvasElements.length);
        
        if (canvasElements.length > 0) {
          console.log('发现canvas元素，可能可以从中提取PDF数据');
        }
      }
      
      // 处理所有找到的下载按钮
      const handleAllButtons = (buttons, description) => {
        console.log(`处理${description}，数量:`, buttons.length);
        buttons.forEach((button, index) => {
          if (!button.hasAttribute('data-intercepted')) {
            console.log(`为${description} #${index}添加点击拦截器:`, button);
            button.setAttribute('data-intercepted', 'true');
            
            button.addEventListener('click', (event) => {
              console.log(`${description} #${index}被点击`);
              // 等待拦截器捕获URL
              setTimeout(() => {
                if (capturedPdfUrl) {
                  console.log('捕获到PDF URL:', capturedPdfUrl);
                  pdfUrl = capturedPdfUrl;
                  filename = `简历_${jobTitle}_${new Date().getTime()}.pdf`;
                  
                  // 告知用户已经捕获了PDF
                  // createToast('已获取简历，可以点击"简历入库"按钮上传');
                } else {
                  console.log('未能捕获PDF URL');
                  
                  // 告知用户无法获取PDF
                  createToast('无法自动获取PDF，请手动下载后通过扩展上传');
                }
              }, 5000);
            });
          }
        });
      };
      
      // 处理所有类型的下载按钮
      handleAllButtons(downloadButtons, '指定结构下载按钮');
      handleAllButtons(textDownloadButtons, '包含下载文本的按钮');
      handleAllButtons(allPossibleDownloadButtons, '可能的下载按钮');
      
      // 正常处理下载按钮(原有逻辑保留)
      downloadButtons.forEach(button => {
        const popoverContent = button.querySelector('.popover-content');
        if (popoverContent) {
          console.log('下载按钮的提示文本:', popoverContent.textContent);
        }
        
        if (popoverContent && popoverContent.textContent?.trim() === '下载') {
          console.log('找到下载按钮');
          
          // 获取下载按钮的点击元素
          const downloadIcon = button.querySelector('span');
          if (downloadIcon && !downloadIcon.getAttribute('data-intercepted')) {
            console.log('为下载按钮添加点击拦截器');
            
            // 标记为已拦截
            downloadIcon.setAttribute('data-intercepted', 'true');
            
            // 为下载按钮添加点击处理程序
            downloadIcon.addEventListener('click', async (event) => {
              // 我们不阻止默认行为，让其正常下载，但我们会捕获请求
              console.log('下载按钮被点击');
              
              // 等待一段时间，让拦截器有机会捕获URL
              setTimeout(() => {
                if (capturedPdfUrl) {
                  console.log('捕获到PDF URL:', capturedPdfUrl);
                  pdfUrl = capturedPdfUrl;
                  filename = `简历_${jobTitle}_${new Date().getTime()}.pdf`;
                  
                  // 告知用户已经捕获了PDF
                  // createToast('已获取简历，可以点击"简历入库"按钮上传');
                } else {
                  console.log('未能捕获PDF URL');
                }
              }, 500);
            });
          }
        }
      });
    } else {
      console.log('未找到PDF查看器, 浮窗将保持隐藏状态');
      floatingWindow.style.display = 'none';
    }
  };

  // 检查iframe中的内容
  const checkIframes = () => {
    const iframes = document.querySelectorAll('iframe');
    console.log('页面中的iframe数量:', iframes.length);
    
    // 查找简历iframe
    const resumeIframes = document.querySelectorAll('iframe.attachment-iframe, iframe.attachment-box');
    if (resumeIframes.length > 0) {
      console.log('找到简历iframe，显示浮窗');
      floatingWindow.style.display = 'block';
      
      // 获取职位信息
      jobTitle = getJobTitle();
      console.log('当前职位:', jobTitle);
      
      // 移除自动下载调用
      // setTimeout(autoDownloadAndUpload, 1000);
      return;
    }
    
    iframes.forEach((iframe, index) => {
      try {
        if (iframe.contentDocument) {
          console.log(`检查iframe ${index}的内容`);
          const pdfInIframe = 
            iframe.contentDocument.querySelector('.pdfViewer') ||
            iframe.contentDocument.querySelector('#viewer.pdfViewer') ||
            iframe.contentDocument.querySelector('[class*="pdfViewer"]') ||
            iframe.contentDocument.querySelector('[id="viewer"]') ||
            // 为iframe内容添加相同的新选择器
            iframe.contentDocument.querySelector('#viewer[class="pdfViewer"]') ||
            iframe.contentDocument.querySelector('div#viewer.pdfViewer') ||
            iframe.contentDocument.querySelector('div.pdfViewer > div.page[data-page-number="1"]') ||
            iframe.contentDocument.querySelector('div.pdfViewer > div.page > div.canvasWrapper > canvas');
          
          if (pdfInIframe) {
            console.log(`在iframe ${index}中找到PDF查看器`);
            floatingWindow.style.display = 'block';
            
            // 获取职位信息
            jobTitle = getJobTitle();
            console.log('当前职位:', jobTitle);
            
            // 移除自动下载调用
            // setTimeout(autoDownloadAndUpload, 1000);
          }
        }
      } catch (e) {
        console.log(`无法访问iframe ${index}的内容:`, e);
      }
    });
  };

  // 进行多次检查，有时DOM可能需要时间加载
  const performMultipleChecks = () => {
    console.log('开始执行多次检查');
    // 立即检查
    checkPdfViewer();
    checkIframes();
    
    // 然后在500ms, 1000ms, 2000ms, 5000ms后再次检查
    const checkTimes = [500, 1000, 2000, 5000];
    checkTimes.forEach(time => {
      setTimeout(() => {
        console.log(`${time}ms后再次检查PDF查看器`);
        checkPdfViewer();
        checkIframes();
      }, time);
    });
  };

  // 监听页面变化
  const observer = new MutationObserver((mutations) => {
    console.log('检测到DOM变化，重新检查PDF查看器');
    // 检查是否应该显示浮窗
    checkPdfViewer();
    checkIframes();
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
    
    console.log('上传按钮被点击，尝试获取PDF文件');
    
    // 修改逻辑，在点击按钮时才尝试获取PDF URL
    // 无论有没有已获取的URL，都尝试重新获取
    setIsProcessing(true);
    createToast('正在获取简历...');
    
    // 调用自动下载函数获取PDF URL
    autoDownloadAndUpload();
    
    // 等待一段时间再检查是否获取到了URL
    setTimeout(async () => {
      if (capturedPdfUrl || pdfUrl) {
        console.log('成功获取到PDF URL，开始上传');
        await performUpload();
      } else {
        createToast('无法获取简历，请手动点击下载按钮');
        setIsProcessing(false); // 恢复按钮状态
      }
    }, 2000); // 增加等待时间，确保有足够时间捕获URL
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
  console.log('window.load事件触发，确保PDF查看器已被检测');
  // 再次尝试运行main函数，以防之前没有成功
  if (document.querySelector('.pdfViewer') || document.querySelector('#viewer')) {
    console.log('在load事件中发现PDF查看器');
    main();
  }
}); 
