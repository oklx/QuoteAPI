import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.PROD ? '' : 'http://localhost:3077',
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // 只有当 401 响应明确表示 token 无效时才清除登录状态
    // 如果是资源需要认证（如受限仓库），不应该清除 token
    if (error.response?.status === 401) {
      const errorMessage = error.response?.data?.error || '';
      // 检查是否是 token 无效的错误（而不是资源需要认证）
      const isTokenInvalid =
        errorMessage.includes('无效的认证令牌') ||
        errorMessage.includes('未提供认证令牌') ||
        errorMessage.includes('token') ||
        errorMessage.includes('令牌');

      // 只有 token 本身无效时才清除登录状态
      // 如果是 API KEY 相关的 401，不清除用户登录状态
      if (isTokenInvalid && !errorMessage.includes('API KEY')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (username, password) => api.post('/auth/login', { username, password }),
  register: (username, password) => api.post('/auth/register', { username, password }),
  getUsers: () => api.get('/auth/users'),
  deleteUser: (id) => api.delete(`/auth/users/${id}`),
  changePassword: (oldPassword, newPassword) => api.post('/auth/change-password', { oldPassword, newPassword })
};

export const repositoryApi = {
  getAll: (params) => api.get('/repositories/all', { params }),
  getUserRepos: () => api.get('/repositories'),
  getById: (id) => api.get(`/repositories/${id}`),
  create: (data) => api.post('/repositories', data),
  update: (id, data) => api.put(`/repositories/${id}`, data),
  delete: (id) => api.delete(`/repositories/${id}`)
};

export const quoteApi = {
  getByRepository: (repoId) => api.get(`/quotes/repository/${repoId}`),
  getById: (id) => api.get(`/quotes/${id}`),
  create: (data) => api.post('/quotes', data),
  update: (id, content) => api.put(`/quotes/${id}`, { content }),
  delete: (id) => api.delete(`/quotes/${id}`)
};

export const apiService = {
  getRandomQuote: (repoName) => api.get(`/api/random/${repoName}`),
  getQuoteDetails: (id) => api.get(`/api/quote/${id}`),
  getStats: (repoId) => api.get(`/api/stats/${repoId}`)
};

export const statsApi = {
  getRepositoryStats: (repoId) => api.get(`/stats/repository/${repoId}`)
};

export const endpointApi = {
  getAll: (params) => api.get('/endpoints/all', { params }),
  getUserEndpoints: () => api.get('/endpoints'),
  getById: (id) => api.get(`/endpoints/${id}`),
  create: (data) => api.post('/endpoints', data),
  update: (id, data) => api.put(`/endpoints/${id}`, data),
  delete: (id) => api.delete(`/endpoints/${id}`),
  toggle: (id) => api.post(`/endpoints/${id}/toggle`),
  run: (name) => api.get(`/endpoints/run/${name}`)
};

export const homeShowcaseApi = {
  getData: () => api.get('/api/home/data'),
  getConfig: () => api.get('/api/home/config'),
  getRepositories: () => api.get('/api/home/repositories'),
  getEndpoints: () => api.get('/api/home/endpoints'),
  setShowcase: (sourceType, sourceName) => api.post('/api/home/set', { sourceType, sourceName }),
  clearShowcase: () => api.post('/api/home/clear')
};

export const apiKeyApi = {
  getAll: () => api.get('/api/apikeys'),
  create: (name) => api.post('/api/apikeys', { name }),
  rename: (id, name) => api.put(`/api/apikeys/${id}`, { name }),
  toggle: (id) => api.post(`/api/apikeys/${id}/toggle`),
  delete: (id) => api.delete(`/api/apikeys/${id}`)
};

export const adminApi = {
  getRepositories: () => api.get('/api/admin/repositories'),
  getEndpoints: () => api.get('/api/admin/endpoints'),
  updateRepoVisibility: (id, visibility) => api.put(`/api/admin/repositories/${id}/visibility`, { visibility }),
  updateEndpointVisibility: (id, visibility) => api.put(`/api/admin/endpoints/${id}/visibility`, { visibility }),
  deleteRepository: (id) => api.delete(`/api/admin/repositories/${id}`),
  deleteEndpoint: (id) => api.delete(`/api/admin/endpoints/${id}`),
  exportBackup: () => api.get('/api/admin/backup/export', { responseType: 'blob' }),
  importBackup: (file) => api.post('/api/admin/backup/import', file, {
    headers: {
      'Content-Type': 'application/octet-stream'
    }
  }),
  // AI 配置
  getAiConfig: () => api.get('/api/admin/ai-config'),
  saveAiConfig: (config) => api.post('/api/admin/ai-config', config),
  testAiConfig: () => api.post('/api/admin/ai-config/test')
};

export default api;
