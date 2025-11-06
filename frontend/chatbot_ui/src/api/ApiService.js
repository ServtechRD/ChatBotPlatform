import axios from 'axios';

const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.isRefreshing = false;
    this.failedQueue = [];

    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      timeout: 10000, // 10 seconds timeout
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // 請求攔截器，用於添加token
    this.axiosInstance.interceptors.request.use(
      config => {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
      },
      error => {
        return Promise.reject(error);
      }
    );

    // 響應攔截器，用於處理錯誤和自動刷新 token
    this.axiosInstance.interceptors.response.use(
      response => response,
      async error => {
        const originalRequest = error.config;

        // 如果收到 401 錯誤且不是 refresh 請求本身
        if (error.response && error.response.status === 401 && !originalRequest._retry) {
          if (this.isRefreshing) {
            // 如果正在刷新，將請求加入隊列
            return new Promise((resolve, reject) => {
              this.failedQueue.push({ resolve, reject });
            }).then(token => {
              originalRequest.headers['Authorization'] = 'Bearer ' + token;
              return this.axiosInstance(originalRequest);
            }).catch(err => {
              return Promise.reject(err);
            });
          }

          originalRequest._retry = true;
          this.isRefreshing = true;

          const refreshToken = localStorage.getItem('refreshToken');

          if (!refreshToken) {
            // 沒有 refresh token，清除並跳轉到登入頁
            this.clearAuthData();
            window.location.href = '/login';
            return Promise.reject(error);
          }

          try {
            // 嘗試刷新 token
            const response = await axios.post(`${this.baseURL}/auth/refresh`, {
              refresh_token: refreshToken
            });

            const newAccessToken = response.data.access_token;
            localStorage.setItem('token', newAccessToken);

            // 處理隊列中的請求
            this.processQueue(null, newAccessToken);
            this.failedQueue = [];

            // 重試原始請求
            originalRequest.headers['Authorization'] = 'Bearer ' + newAccessToken;
            return this.axiosInstance(originalRequest);
          } catch (refreshError) {
            // Refresh token 也過期，清除並跳轉到登入頁
            this.processQueue(refreshError, null);
            this.failedQueue = [];
            this.clearAuthData();
            window.location.href = '/login';
            return Promise.reject(refreshError);
          } finally {
            this.isRefreshing = false;
          }
        }

        return Promise.reject(error);
      }
    );
  }

  processQueue(error, token = null) {
    this.failedQueue.forEach(prom => {
      if (error) {
        prom.reject(error);
      } else {
        prom.resolve(token);
      }
    });
  }

  clearAuthData() {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userData');
  }

  // 登錄方法
  async login(email, password) {
    console.log('call login');
    try {
      const formData = new URLSearchParams();
      formData.append('username', email); // 替换为用户输入的邮箱
      formData.append('password', password); // 替换为用户输入的密码
      const response = await this.axiosInstance.post('/auth/login', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      if (response.data.access_token) {
        localStorage.setItem('token', response.data.access_token);
      }
      if (response.data.refresh_token) {
        localStorage.setItem('refreshToken', response.data.refresh_token);
      }
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  getUserId() {
    const userData = localStorage.getItem('userData');
    if (userData) {
      return JSON.parse(userData).user_id;
    }
    return null;
  }

  // 獲取用戶郵箱
  getUserEmail() {
    const userData = localStorage.getItem('userData');
    if (userData) {
      return JSON.parse(userData).email;
    }
    return null;
  }

  // 獲取用戶的assistants
  getUserAssistants() {
    const userData = localStorage.getItem('userData');
    if (userData) {
      return JSON.parse(userData).assistants;
    }
    return null;
  }

  // 獲取用assistants
  getAssistatns() {
    const assistantsData = localStorage.getItem('assistantsData');
    if (assistantsData) {
      return JSON.parse(assistantsData);
    }
    return null;
  }

  // 註冊方法
  async register(email, password) {
    try {
      const response = await this.axiosInstance.post('/auth/register', {
        email,
        password,
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // 登出方法
  logout() {
    this.clearAuthData();
    // 可以在這裡添加其他清理操作
  }

  // 獲取用戶資料
  // MARK: 這個有噴錯
  async fetchUserData() {
    try {
      const response = await this.axiosInstance.get('/auth/users/me');

      const userData = response.data;
      localStorage.setItem('userData', JSON.stringify(userData));
      return userData;
    } catch (error) {
      console.error('Failed to fetch user data:', error);
      throw error;
    }
  }

  // 更新用戶資料
  async updateUserProfile(userData) {
    try {
      const response = await this.axiosInstance.put('/user/profile', userData);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // 註冊方法
  async createAssistant(formData) {
    try {
      const response = await this.axiosInstance.post(
        '/assistant/create',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async updateAssistant(id, formData) {
    try {
      const response = await this.axiosInstance.put(
        `/assistant/${id}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // 獲取用戶資料
  async fetchAssistants() {
    try {
      const user_id = this.getUserId();
      const response = await this.axiosInstance.get(
        `/user/${user_id}/assistants`
      );
      const assistants = response.data;
      localStorage.setItem('assistantsData', JSON.stringify(assistants));
      return assistants;
    } catch (error) {
      console.error('Failed to fetch user data:', error);
      throw error;
    }
  }

  // 獲取知識庫列表
  async getKnowledgeBases(assistantId) {
    try {
      const response = await this.axiosInstance.get(
        `assistant/${assistantId}/knowledge`
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async uploadFile(assistantId, formData) {
    try {
      const response = await this.axiosInstance.post(
        `/assistant/${assistantId}/upload`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async uploadUrl(assistantId, url) {
    try {
      const response = await this.axiosInstance.post(
        `/assistant/${assistantId}/upload`,
        { url }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // 創建新的知識庫
  async createKnowledgeBase(knowledgeBaseData) {
    try {
      const response = await this.axiosInstance.post(
        '/knowledge-bases',
        knowledgeBaseData
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // 獲取使用者的對話列表
  async fetchUserConversations(assistantId) {
    try {
      const response = await this.axiosInstance.get(
        `/user/${assistantId}/conversations`
      );

      return response?.data || [];
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
      throw error;
    }
  }

  async submitText(assistantId, text) {
    try {
      const formData = new FormData();
      const blob = new Blob([text], { type: 'text/plain' });
      formData.append('file', blob, 'manual_input.txt');

      const response = await this.axiosInstance.post(
        `/assistant/${assistantId}/upload`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to submit text knowledge:', error);
      throw error;
    }
  }
}

export default new ApiService();
