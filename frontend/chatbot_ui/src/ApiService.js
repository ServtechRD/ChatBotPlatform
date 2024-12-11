import axios from 'axios';

class ApiService {
  constructor() {
    this.baseURL = 'http://192.168.1.234:36100'; // 替換為您的API域名和端口
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

    // 響應攔截器，用於處理錯誤
    this.axiosInstance.interceptors.response.use(
      response => response,
      error => {
        if (error.response && error.response.status === 401) {
          // 處理未授權錯誤，例如重定向到登錄頁面
          // 您可能需要導入並使用react-router的history對象
          // history.push('/login');
        }
        return Promise.reject(error);
      }
    );
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
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    // 可以在這裡添加其他清理操作
  }

  // 獲取用戶資料
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
      return response.data;
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
      throw error;
    }
  }

  // 您可以繼續添加其他API方法...
}

export default new ApiService();
