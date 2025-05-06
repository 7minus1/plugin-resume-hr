/**
 * API客户端工具，封装统一的请求响应结果过滤器
 */
import axios from 'axios';
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { config as envConfig } from '../config/env';

// API响应类型定义
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  code?: number;
  data: T;
  timestamp?: string;
  path?: string;
}

// 创建axios实例
const apiClient: AxiosInstance = axios.create({
  baseURL: envConfig.API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true
});

// 请求拦截器，添加token
apiClient.interceptors.request.use(
  async (config) => {
    // 尝试获取token
    let result = await chrome.storage.local.get(['access_token']);
    let token = result.access_token;
    
    // 如果token存在，添加到请求头
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    console.error('请求拦截器错误:', error);
    return Promise.reject(error);
  }
);

// 响应拦截器，处理401错误
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    console.error('响应拦截器 - 请求错误:', error);
    
    // 处理401 Unauthorized错误
    if (error.response && error.response.status === 401) {
      console.error('登录信息已过期，需要重新登录');
      
      // 清除本地存储中的登录信息
      await chrome.storage.local.remove(['access_token', 'user']);
      
      // 重定向到主页
      window.location.href = '/tabs/home.html';
      
      return Promise.reject(new Error('登录信息已过期，请重新登录'));
    }
    
    // 处理自定义错误码
    if (error.response && error.response.data && error.response.data.code === 401) {
      console.error('登录信息已过期，需要重新登录');
      
      // 清除本地存储中的登录信息
      await chrome.storage.local.remove(['access_token', 'user']);
      
      // 重定向到主页
      window.location.href = '/tabs/home.html';
      
      return Promise.reject(new Error('登录信息已过期，请重新登录'));
    }
    
    return Promise.reject(error);
  }
);

/**
 * GET请求
 * @param url 请求地址
 * @param params 请求参数
 * @param config 请求配置
 */
export const get = async <T>(url: string, params?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => {
  try {
    const response = await apiClient.get<ApiResponse<T>>(url, { params, ...config });
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * POST请求
 * @param url 请求地址
 * @param data 请求数据
 * @param config 请求配置
 */
export const post = async <T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => {
  try {
    const response = await apiClient.post<ApiResponse<T>>(url, data, config);
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * PUT请求
 * @param url 请求地址
 * @param data 请求数据
 * @param config 请求配置
 */
export const put = async <T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => {
  try {
    const response = await apiClient.put<ApiResponse<T>>(url, data, config);
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * DELETE请求
 * @param url 请求地址
 * @param config 请求配置
 */
export const del = async <T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => {
  try {
    const response = await apiClient.delete<ApiResponse<T>>(url, config);
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * 文件上传请求
 * @param url 请求地址
 * @param formData FormData对象
 * @param config 请求配置
 */
export const uploadFile = async <T>(url: string, formData: FormData, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => {
  try {
    const uploadConfig = {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      ...config,
    };
    
    const response = await apiClient.post<ApiResponse<T>>(url, formData, uploadConfig);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export default {
  get,
  post,
  put,
  del,
  uploadFile,
  client: apiClient,
}; 