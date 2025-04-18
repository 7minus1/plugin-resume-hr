// 用户认证服务
import axios from 'axios';

// API基础URL
const API_BASE_URL = 'http://localhost:3000/api';

// 用户类型定义
interface User {
  id: number;
  email: string;
  username?: string;
  isActive?: boolean;
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
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
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
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// 用户注册
export const register = async (userData: { username?: string; email: string; password: string }) => {
  try {
    const response = await api.post('/users/register', userData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// 用户登录
export const login = async (credentials: { email: string; password: string }): Promise<LoginResponse> => {
  try {
    const response = await api.post('/users/login', credentials);
    console.log('Login response:', response.data);
    
    // 保存token
    await chrome.storage.local.set({
      access_token: response.data.access_token
    });

    // 获取用户信息
    const userData = await getUserProfile();
    console.log('User profile:', userData);
    
    // 保存用户信息
    await chrome.storage.local.set({
      user: JSON.stringify(userData)
    });

    return {
      access_token: response.data.access_token,
      user: userData
    };
  } catch (error) {
    throw error;
  }
};

// 验证码登录
export const loginWithVerification = async (data: { email: string; password: string; code: string }): Promise<LoginResponse> => {
  try {
    const response = await api.post('/users/login/verify', data);
    console.log('Login with verification response:', response.data);
    
    // 保存token
    await chrome.storage.local.set({
      access_token: response.data.access_token
    });

    // 获取用户信息
    const userData = await getUserProfile();
    console.log('User profile:', userData);
    
    // 保存用户信息
    await chrome.storage.local.set({
      user: JSON.stringify(userData)
    });

    return {
      access_token: response.data.access_token,
      user: userData
    };
  } catch (error) {
    throw error;
  }
};

// 发送验证码
export const sendVerificationCode = async (email: string) => {
  try {
    const response = await api.post('/users/verification/send', { email });
    return response.data;
  } catch (error) {
    throw error;
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