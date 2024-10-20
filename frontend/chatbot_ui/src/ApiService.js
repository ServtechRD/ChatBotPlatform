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
    try {
      const response = await this.axiosInstance.post('/login', {
        email,
        password,
      });
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
      }
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // 註冊方法
  async register(email, password) {
    try {
      const response = await this.axiosInstance.post('/register', {
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
    // 可以在這裡添加其他清理操作
  }

  // 獲取用戶資料
  async getUserProfile() {
    try {
      const response = await this.axiosInstance.get('/user/profile');
      return response.data;
    } catch (error) {
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

  // 獲取知識庫列表
  async getKnowledgeBases() {
    try {
      const response = await this.axiosInstance.get('/knowledge-bases');
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

  // 您可以繼續添加其他API方法...
}

export default new ApiService();
