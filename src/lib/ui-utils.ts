/**
 * UI相关的工具函数
 */

/**
 * 创建提示框
 * @param message 要显示的消息
 * @param duration 显示时长（毫秒），默认3000ms
 * @param position 显示位置，默认为顶部中间
 */
export const createToast = (message: string, duration = 3000, position: 'top' | 'bottom' = 'top') => {
  const toast = document.createElement('div')
  
  // 根据位置设置样式
  const positionStyle = position === 'top' 
    ? `top: 20px; bottom: auto;` 
    : `bottom: 20px; top: auto;`;
  
  toast.style.cssText = `
    position: fixed;
    ${positionStyle}
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
  
  // 指定时间后自动消失
  setTimeout(() => {
    toast.style.opacity = '0'
    setTimeout(() => {
      document.body.removeChild(toast)
    }, 300)
  }, duration)
} 