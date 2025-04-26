// 环境配置
const ENV = {
  development: {
    API_BASE_URL: 'http://localhost:3000/api'
    // API_BASE_URL: 'https://www.ituili.com/api'
  },
  production: {
    // API_BASE_URL: 'https://plugins-backend.vercel.app/api'
    API_BASE_URL: 'https://www.ituili.com/api'
  }
};

// 根据环境变量获取当前环境
const currentEnv = process.env.NODE_ENV || 'development';

// 导出当前环境的配置
export const config = ENV[currentEnv]; 