// 用户认证服务
import axios from 'axios';
import { config } from '../config/env';

// 用户类型定义
interface User {
  id: number;
  phoneNumber: string;
  username?: string;
  isActive?: boolean;
  isVip?: boolean;
  vipExpireDate?: string;
  uploadCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

// 登录响应类型
interface LoginResponse {
  access_token: string;
  user: User;
}

// 创建axios实例
const api = axios.create({
  baseURL: config.API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true
});

// 请求拦截器，添加token
api.interceptors.request.use(
  async (config) => {
    const result = await chrome.storage.local.get(['access_token']);
    const token = result.access_token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器，处理token过期
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      // token过期，清除存储并重定向到登录页
      chrome.storage.local.remove(['access_token', 'user']);
      // window.location.href = '/tabs/home.html';
    }
    return Promise.reject(error);
  }
);

// 发送验证码
export const sendVerificationCode = async (phoneNumber: string) => {
  try {
    const response = await api.post('/users/send-verification-code', { phoneNumber });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      // 处理Axios错误
      if (error.response) {
        // 服务器返回了错误状态码
        throw new Error(error.response.data?.message || '发送验证码失败');
      } else if (error.request) {
        // 请求已发送但没有收到响应
        throw new Error('无法连接到服务器，请检查网络连接');
      }
    }
    // 处理其他错误
    throw new Error('发送验证码失败，请稍后重试');
  }
};

// 验证码登录/注册
export const verifyCode = async (data: { phoneNumber: string; code: string }): Promise<LoginResponse> => {
  try {
    const response = await api.post('/users/verify-code', data);
    console.log('验证码登录/注册响应:', response.data);
    
    // 保存token
    await chrome.storage.local.set({
      access_token: response.data.access_token
    });

    // 保存用户信息
    await chrome.storage.local.set({
      user: JSON.stringify(response.data.user)
    });

    return {
      access_token: response.data.access_token,
      user: response.data.user
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      // 处理Axios错误
      if (error.response) {
        // 服务器返回了错误状态码
        throw new Error(error.response.data?.message || '验证码错误或已过期');
      } else if (error.request) {
        // 请求已发送但没有收到响应
        throw new Error('无法连接到服务器，请检查网络连接');
      }
    }
    // 处理其他错误
    throw new Error('登录失败，请稍后重试');
  }
};

// 获取用户信息
export const getUserProfile = async (): Promise<User> => {
  try {
    const response = await api.get('/users/profile');
    return response.data;
  } catch (error) {
    throw error;
  }
};

// 用户登出
export const logout = async () => {
  // 清除Chrome存储的token和用户信息
  await chrome.storage.local.remove(['access_token', 'user']);
  // 重定向到扩展主页
  window.location.href = '/tabs/home.html';
};

// 检查用户是否已登录
export const isAuthenticated = async (): Promise<boolean> => {
  const result = await chrome.storage.local.get(['access_token']);
  console.log('Checking authentication, token:', result.access_token);
  return !!result.access_token;
};

// 获取当前登录用户
export const getCurrentUser = async (): Promise<User | null> => {
  const result = await chrome.storage.local.get(['user']);
  console.log('Getting current user, stored data:', result);
  if (!result.user) {
    return null;
  }
  try {
    const userData = JSON.parse(result.user);
    console.log('Parsed user data:', userData);
    return userData;
  } catch (error) {
    console.error('Error parsing user data:', error);
    return null;
  }
};

// 获取多维表格信息
export const getBitableInfo = async (): Promise<{
  id: number;
  userId: number;
  bitableUrl: string;
  bitableToken: string;
  createdAt: string;
  updatedAt: string;
} | null> => {
  try {
    const response = await api.get('/users/bitable');
    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return null;
    }
    throw error;
  }
};

// 更新多维表格信息
export const updateBitableInfo = async (data: {
  bitableUrl: string;
  bitableToken: string;
}): Promise<{
  id: number;
  userId: number;
  bitableUrl: string;
  bitableToken: string;
  createdAt: string;
  updatedAt: string;
}> => {
  try {
    const response = await api.put('/users/bitable', data);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// 获取用户VIP状态
export const getUserVipStatus = async (): Promise<{
  isVip: boolean;
  vipExpireDate?: string;
  vipLevel?: number;
}> => {
  try {
    const response = await api.get('/users/vip-status');
    return response.data;
  } catch (error) {
    throw error;
  }
};

// 获取用户剩余上传次数
export const getUserUploadQuota = async (): Promise<{
  uploadCount: number;
  remainingCount: number;
  isUnlimited: boolean;
}> => {
  try {
    const response = await api.get('/users/upload-count');
    return response.data;
  } catch (error) {
    throw error;
  }
}; 