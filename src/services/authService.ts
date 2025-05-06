// 用户认证服务
import axios from 'axios';
import apiClient from '../lib/api-client';
import type { ApiResponse } from '../lib/api-client';

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

// 多维表格信息类型
interface BitableInfo {
  configured: boolean;
  data?: {
    id: number;
    userId: number;
    bitableUrl: string;
    bitableToken: string;
    tableId?: string;
    createdAt: string;
    updatedAt: string;
  };
}

// 发送验证码
export const sendVerificationCode = async (phoneNumber: string) => {
  try {
    const response = await apiClient.post<any>('/users/send-verification-code', { phoneNumber });
    console.log('发送验证码响应:', response);
    
    // 检查响应是否成功
    if (!response.success) {
      throw new Error(response.message || '发送验证码失败');
    }
    
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      // 处理Axios错误
      if (error.response) {
        // 服务器返回了错误状态码
        console.error('服务器返回错误:', error.response.status, error.response.data);
        throw new Error(error.response.data?.message || '发送验证码失败');
      } else if (error.request) {
        // 请求已发送但没有收到响应
        console.error('请求已发送但没有收到响应:', error.request);
        throw new Error('无法连接到服务器，请检查网络连接');
      }
    }
    // 处理其他错误
    console.error('其他错误:', error);
    throw new Error('发送验证码失败，请稍后重试');
  }
};

// 验证码登录/注册
export const verifyCode = async (data: { phoneNumber: string; code: string }): Promise<LoginResponse> => {
  try {
    console.log('开始验证码登录/注册请求...');
    const response = await apiClient.post<LoginResponse>('/users/verify-code', data);
    console.log('验证码登录/注册响应:', response);
    
    // 检查响应是否成功
    if (!response.success) {
      throw new Error(response.message || '登录失败');
    }
    
    // 保存token和用户信息
    console.log('保存token和用户信息到Chrome存储...');
    
    // 使用类型断言确保data存在
    const responseData = response.data as LoginResponse;
    
    // 使用Promise.all确保两个存储操作都完成
    await Promise.all([
      chrome.storage.local.set({ access_token: responseData.access_token }),
      chrome.storage.local.set({ user: JSON.stringify(responseData.user) })
    ]);
    
    // 验证token是否已正确保存
    const verifyResult = await chrome.storage.local.get(['access_token', 'user']);
    console.log('验证token保存结果:', verifyResult);
    
    if (!verifyResult.access_token) {
      console.error('token保存失败，尝试重新保存');
      // 再次尝试保存token
      await chrome.storage.local.set({ access_token: responseData.access_token });
    }
    
    // 添加一个小延迟，确保存储操作完成
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return responseData;
  } catch (error) {
    console.error('验证码登录/注册失败:', error);
    if (axios.isAxiosError(error)) {
      // 处理Axios错误
      if (error.response) {
        // 服务器返回了错误状态码
        console.error('服务器返回错误:', error.response.status, error.response.data);
        throw new Error(error.response.data?.message || '验证码错误或已过期');
      } else if (error.request) {
        // 请求已发送但没有收到响应
        console.error('请求已发送但没有收到响应:', error.request);
        throw new Error('无法连接到服务器，请检查网络连接');
      }
    }
    // 处理其他错误
    console.error('其他错误:', error);
    throw new Error('登录失败，请稍后重试');
  }
};

// 获取用户信息
export const getUserProfile = async (): Promise<User> => {
  try {
    const response = await apiClient.get<User>('/users/profile');
    console.log('获取用户信息响应:', response);
    
    // 检查响应是否成功
    if (!response.success) {
      throw new Error(response.message || '获取用户信息失败');
    }
    
    return response.data as User;
  } catch (error) {
    console.error('获取用户信息失败:', error);
    throw error;
  }
};

// 用户登出
export const logout = async () => {
  // 无论请求是否成功，都清除本地存储
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
    const userData = JSON.parse(result.user) as User;
    console.log('Parsed user data:', userData);
    return userData;
  } catch (error) {
    console.error('Error parsing user data:', error);
    return null;
  }
};

// 获取多维表格信息
export const getBitableInfo = async (): Promise<BitableInfo | null> => {
  try {
    console.log('开始获取多维表格信息...');
    
    const response = await apiClient.get<BitableInfo>('/users/bitable');
    console.log('获取多维表格信息响应:', response);
    
    // 检查响应是否成功
    if (!response.success) {
      if (response.code === 404) {
        console.log('多维表格信息不存在');
        return null;
      }
      throw new Error(response.message || '获取多维表格信息失败');
    }
    
    return response.data as BitableInfo;
  } catch (error) {
    console.error('获取多维表格信息失败:', error);
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
    console.log('开始更新多维表格信息...');
    
    const response = await apiClient.put<{
      id: number;
      userId: number;
      bitableUrl: string;
      bitableToken: string;
      createdAt: string;
      updatedAt: string;
    }>('/users/bitable', data);
    console.log('更新多维表格信息响应:', response);
    
    // 检查响应是否成功
    if (!response.success) {
      throw new Error(response.message || '更新多维表格信息失败');
    }
    
    return response.data;
  } catch (error) {
    console.error('更新多维表格信息失败:', error);
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
    console.log('开始获取用户VIP状态...');
    
    const response = await apiClient.get<{
      isVip: boolean;
      vipExpireDate?: string;
      vipLevel?: number;
    }>('/users/vip-status');
    console.log('获取用户VIP状态响应:', response);
    
    // 检查响应是否成功
    if (!response.success) {
      throw new Error(response.message || '获取用户VIP状态失败');
    }
    
    return response.data;
  } catch (error) {
    console.error('获取用户VIP状态失败:', error);
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
    console.log('开始获取用户上传配额...');
    
    const response = await apiClient.get<{
      uploadCount: number;
      remainingCount: number;
      isUnlimited: boolean;
    }>('/users/upload-count');
    console.log('获取用户上传配额响应:', response);
    
    // 检查响应是否成功
    if (!response.success) {
      throw new Error(response.message || '获取用户上传配额失败');
    }
    
    return response.data;
  } catch (error) {
    console.error('获取用户上传配额失败:', error);
    throw error;
  }
}; 