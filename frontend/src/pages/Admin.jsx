import React, { useState, useEffect } from 'react';
import { authApi, homeShowcaseApi, adminApi } from '../api';
import { useAuth } from '../AuthContext';
import { formatBeijingDateTime } from '../utils/timeUtils';
import './Admin.css';

const HomeShowcaseSettings = () => {
  const [config, setConfig] = useState(null);
  const [repositories, setRepositories] = useState([]);
  const [endpoints, setEndpoints] = useState([]);
  const [sourceType, setSourceType] = useState('repository');
  const [sourceName, setSourceName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [configRes, reposRes, endpointsRes] = await Promise.all([
        homeShowcaseApi.getConfig(),
        homeShowcaseApi.getRepositories(),
        homeShowcaseApi.getEndpoints()
      ]);

      setConfig(configRes.data);
      setRepositories(Array.isArray(reposRes.data) ? reposRes.data : []);
      setEndpoints(Array.isArray(endpointsRes.data) ? endpointsRes.data : []);

      if (configRes.data && configRes.data.source_type) {
        setSourceType(configRes.data.source_type);
        setSourceName(configRes.data.source_name);
      }
    } catch (err) {
      console.error('加载配置失败:', err);
      setRepositories([]);
      setEndpoints([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!sourceName) {
      alert('请选择一个来源');
      return;
    }

    setSaving(true);
    try {
      await homeShowcaseApi.setShowcase(sourceType, sourceName);
      alert('设置成功');
      loadData();
    } catch (err) {
      alert(err.response?.data?.error || '设置失败');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (window.confirm('确定要清除首页展示配置吗？')) {
      setSaving(true);
      try {
        await homeShowcaseApi.clearShowcase();
        setSourceName('');
        setConfig(null);
        alert('已清除');
      } catch (err) {
        alert('操作失败');
      } finally {
        setSaving(false);
      }
    }
  };

  if (loading) {
    return <div className="showcase-settings-loading">加载中...</div>;
  }

  const currentOptions = sourceType === 'repository' ? repositories : endpoints;

  return (
    <div className="showcase-settings card">
      <div className="showcase-settings-header">
        <h2>首页展示设置</h2>
        <p className="showcase-settings-desc">
          配置首页展示的语句来源，可以选择仓库或端口
        </p>
      </div>

      {config && config.source_type && (
        <div className="current-config">
          <span className="config-label">当前配置：</span>
          <span className="config-value">
            {config.source_type === 'repository' ? '仓库' : '端口'} - {config.source_name}
          </span>
          <span className={`config-status ${config.is_active ? 'active' : ''}`}>
            {config.is_active ? '已启用' : '未启用'}
          </span>
        </div>
      )}

      <div className="showcase-form">
        <div className="form-row">
          <div className="form-group">
            <label>来源类型</label>
            <div className="source-type-tabs">
              <button
                type="button"
                className={`tab-btn ${sourceType === 'repository' ? 'active' : ''}`}
                onClick={() => {
                  setSourceType('repository');
                  setSourceName('');
                }}
              >
                仓库
              </button>
              <button
                type="button"
                className={`tab-btn ${sourceType === 'endpoint' ? 'active' : ''}`}
                onClick={() => {
                  setSourceType('endpoint');
                  setSourceName('');
                }}
              >
                端口
              </button>
            </div>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>选择{sourceType === 'repository' ? '仓库' : '端口'}</label>
            {currentOptions.length === 0 ? (
              <p className="no-options">
                暂无可用的{sourceType === 'repository' ? '仓库' : '端口'}
              </p>
            ) : (
              <div className="source-options">
                {currentOptions.map((item) => (
                  <div
                    key={item.id}
                    className={`source-option ${sourceName === item.name ? 'selected' : ''}`}
                    onClick={() => setSourceName(item.name)}
                  >
                    <div className="source-option-name">{item.name}</div>
                    {item.description && (
                      <div className="source-option-desc">{item.description}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="form-actions">
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || !sourceName}
          >
            {saving ? '保存中...' : '保存设置'}
          </button>
          {config && config.source_type && (
            <button
              className="btn btn-secondary"
              onClick={handleClear}
              disabled={saving}
            >
              清除配置
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const VisibilityBadge = ({ visibility }) => {
  const labels = {
    public: '公开',
    restricted: '受限',
    private: '私有'
  };
  return (
    <span className={`visibility-badge visibility-${visibility || 'public'}`}>
      {labels[visibility] || '公开'}
    </span>
  );
};

const VisibilitySelect = ({ value, onChange }) => {
  return (
    <select
      className="visibility-select"
      value={value || 'public'}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="public">公开</option>
      <option value="restricted">受限</option>
      <option value="private">私有</option>
    </select>
  );
};

const RepositoryManagement = () => {
  const [repositories, setRepositories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadRepositories();
  }, []);

  const loadRepositories = async () => {
    try {
      const response = await adminApi.getRepositories();
      setRepositories(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error('加载仓库失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVisibilityChange = async (id, visibility) => {
    try {
      await adminApi.updateRepoVisibility(id, visibility);
      loadRepositories();
    } catch (err) {
      alert(err.response?.data?.error || '更新失败');
    }
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`确定要删除仓库 "${name}" 吗？这将删除所有相关的语句！`)) {
      try {
        await adminApi.deleteRepository(id);
        loadRepositories();
      } catch (err) {
        alert(err.response?.data?.error || '删除失败');
      }
    }
  };

  const filteredRepos = repositories.filter(repo =>
    repo.name.toLowerCase().includes(search.toLowerCase()) ||
    repo.username?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="loading-state">加载中...</div>;

  return (
    <div className="admin-section">
      <div className="section-header">
        <h2>仓库管理</h2>
        <div className="section-search">
          <input
            type="text"
            placeholder="搜索仓库名或用户名..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
        </div>
      </div>
      <div className="data-table card">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>仓库名</th>
              <th>所有者</th>
              <th>语句数</th>
              <th>API调用</th>
              <th>可见性</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredRepos.map((repo) => (
              <tr key={repo.id}>
                <td>{repo.id}</td>
                <td className="name-cell">{repo.name}</td>
                <td>{repo.username}</td>
                <td>{repo.quote_count || 0}</td>
                <td>{repo.api_calls || 0}</td>
                <td>
                  <VisibilitySelect
                    value={repo.visibility}
                    onChange={(v) => handleVisibilityChange(repo.id, v)}
                  />
                </td>
                <td>{formatBeijingDateTime(repo.created_at)}</td>
                <td>
                  <button
                    onClick={() => handleDelete(repo.id, repo.name)}
                    className="btn btn-danger btn-sm"
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredRepos.length === 0 && (
          <div className="empty-table">没有找到匹配的仓库</div>
        )}
      </div>
    </div>
  );
};

const EndpointManagement = () => {
  const [endpoints, setEndpoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadEndpoints();
  }, []);

  const loadEndpoints = async () => {
    try {
      const response = await adminApi.getEndpoints();
      setEndpoints(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error('加载端口失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVisibilityChange = async (id, visibility) => {
    try {
      await adminApi.updateEndpointVisibility(id, visibility);
      loadEndpoints();
    } catch (err) {
      alert(err.response?.data?.error || '更新失败');
    }
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`确定要删除端口 "${name}" 吗？`)) {
      try {
        await adminApi.deleteEndpoint(id);
        loadEndpoints();
      } catch (err) {
        alert(err.response?.data?.error || '删除失败');
      }
    }
  };

  const filteredEndpoints = endpoints.filter(ep =>
    ep.name.toLowerCase().includes(search.toLowerCase()) ||
    ep.username?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="loading-state">加载中...</div>;

  return (
    <div className="admin-section">
      <div className="section-header">
        <h2>端口管理</h2>
        <div className="section-search">
          <input
            type="text"
            placeholder="搜索端口名或用户名..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
        </div>
      </div>
      <div className="data-table card">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>端口名</th>
              <th>所有者</th>
              <th>调用次数</th>
              <th>状态</th>
              <th>可见性</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredEndpoints.map((ep) => (
              <tr key={ep.id}>
                <td>{ep.id}</td>
                <td className="name-cell">{ep.name}</td>
                <td>{ep.username}</td>
                <td>{ep.call_count || 0}</td>
                <td>
                  <span className={`status-badge ${ep.is_active ? 'active' : 'inactive'}`}>
                    {ep.is_active ? '启用' : '禁用'}
                  </span>
                </td>
                <td>
                  <VisibilitySelect
                    value={ep.visibility}
                    onChange={(v) => handleVisibilityChange(ep.id, v)}
                  />
                </td>
                <td>{formatBeijingDateTime(ep.created_at)}</td>
                <td>
                  <button
                    onClick={() => handleDelete(ep.id, ep.name)}
                    className="btn btn-danger btn-sm"
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredEndpoints.length === 0 && (
          <div className="empty-table">没有找到匹配的端口</div>
        )}
      </div>
    </div>
  );
};

const AiConfigSettings = () => {
  const [config, setConfig] = useState({
    apiUrl: '',
    apiKey: '',
    model: 'gpt-3.5-turbo'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await adminApi.getAiConfig();
      setConfig({
        apiUrl: response.data.apiUrl || '',
        apiKey: response.data.apiKeyMasked || '',
        model: response.data.model || 'gpt-3.5-turbo'
      });
    } catch (err) {
      console.error('加载AI配置失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config.apiUrl || !config.model) {
      alert('API 地址和模型名称不能为空');
      return;
    }

    setSaving(true);
    try {
      await adminApi.saveAiConfig(config);
      alert('配置保存成功');
      loadConfig();
    } catch (err) {
      alert(err.response?.data?.error || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const response = await adminApi.testAiConfig();
      setTestResult({
        success: true,
        message: response.data.message,
        response: response.data.response
      });
    } catch (err) {
      setTestResult({
        success: false,
        message: err.response?.data?.error || '测试失败'
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <div className="loading-state">加载中...</div>;
  }

  return (
    <div className="ai-config-settings card">
      <div className="ai-config-header">
        <h2>AI 大模型配置</h2>
        <p className="ai-config-desc">
          配置 OpenAI 兼容的 API，端口编程中可使用 <code>ask_ai(prompt)</code> 函数调用 AI
        </p>
      </div>

      <div className="ai-config-form">
        <div className="form-group">
          <label>API 地址</label>
          <input
            type="text"
            value={config.apiUrl}
            onChange={(e) => setConfig({ ...config, apiUrl: e.target.value })}
            placeholder="https://api.openai.com/v1/chat/completions"
            className="form-input"
          />
          <span className="form-hint">支持 OpenAI 兼容的 API 地址（如 OpenAI、Azure、国内中转等）</span>
        </div>

        <div className="form-group">
          <label>API Key</label>
          <input
            type="password"
            value={config.apiKey}
            onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
            placeholder="sk-..."
            className="form-input"
          />
          <span className="form-hint">输入新的 API Key 会覆盖原有配置</span>
        </div>

        <div className="form-group">
          <label>模型名称</label>
          <input
            type="text"
            value={config.model}
            onChange={(e) => setConfig({ ...config, model: e.target.value })}
            placeholder="gpt-3.5-turbo"
            className="form-input"
          />
          <span className="form-hint">常用模型：gpt-3.5-turbo, gpt-4, gpt-4-turbo 等</span>
        </div>

        <div className="form-actions">
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '保存中...' : '保存配置'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleTest}
            disabled={testing || !config.apiUrl}
          >
            {testing ? '测试中...' : '测试连接'}
          </button>
        </div>

        {testResult && (
          <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
            <strong>{testResult.success ? '连接成功' : '连接失败'}</strong>
            <p>{testResult.message}</p>
            {testResult.response && (
              <p className="test-response">AI 响应: {testResult.response}</p>
            )}
          </div>
        )}
      </div>

      <div className="ai-usage-guide">
        <h3>使用说明</h3>
        <p>配置完成后，在端口编程中可以使用以下函数：</p>
        <pre>{`# 调用 AI 大模型
response = ask_ai("你好，请介绍一下自己")
# response 是字符串类型，包含 AI 的回复内容

# 也可以指定 max_tokens
response = ask_ai("写一首诗", max_tokens=500)`}</pre>
      </div>
    </div>
  );
};

const DataBackupSettings = () => {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const getErrorMessage = (err, fallback) => {
    const data = err.response?.data;
    if (data?.error) {
      return data.error;
    }
    if (typeof data === 'string') {
      return data;
    }
    return err.message || fallback;
  };

  const getBackupFilename = (headers) => {
    const disposition = headers?.['content-disposition'] || '';
    const match = disposition.match(/filename="?([^"]+)"?/);
    if (match?.[1]) {
      return match[1];
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `quoteapi-backup-${timestamp}.db`;
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await adminApi.exportBackup();
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = getBackupFilename(response.headers);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(getErrorMessage(err, '导出失败'));
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      alert('请选择要导入的备份文件');
      return;
    }

    const confirmed = window.confirm(
      '导入会替换当前全部数据，包括用户、仓库、语句、端口、API Key、日志和系统配置。确定继续吗？'
    );
    if (!confirmed) {
      return;
    }

    setImporting(true);
    try {
      await adminApi.importBackup(selectedFile);
      alert('导入成功，页面将刷新');
      window.location.reload();
    } catch (err) {
      alert(getErrorMessage(err, '导入失败，请确认文件是 QuoteAPI 的 SQLite 备份'));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="data-backup-settings card">
      <div className="data-backup-header">
        <h2>数据备份</h2>
        <p className="data-backup-desc">
          导出或导入完整数据库，包含用户、仓库、语句、端口、API Key、访问日志和系统配置。
        </p>
      </div>

      <div className="backup-actions-grid">
        <div className="backup-action-panel">
          <h3>导出全部数据</h3>
          <p>生成 SQLite 一致性备份文件，可用于迁移到新服务器或本地留档。</p>
          <button
            className="btn btn-primary"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? '导出中...' : '下载备份文件'}
          </button>
        </div>

        <div className="backup-action-panel">
          <h3>导入全部数据</h3>
          <p>上传之前导出的 .db 文件。导入前会校验数据库完整性和必要表结构。</p>
          <input
            type="file"
            accept=".db,.sqlite,.sqlite3,application/octet-stream,application/x-sqlite3"
            className="backup-file-input"
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            disabled={importing}
          />
          {selectedFile && (
            <div className="selected-backup-file">
              已选择：{selectedFile.name}
            </div>
          )}
          <button
            className="btn btn-danger"
            onClick={handleImport}
            disabled={importing || !selectedFile}
          >
            {importing ? '导入中...' : '导入并替换当前数据'}
          </button>
        </div>
      </div>

      <div className="backup-note">
        导入旧版本数据库后，服务端会自动补齐当前版本需要的字段和默认管理员账号。
      </div>
    </div>
  );
};

const Admin = () => {
  const { loading: authLoading } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('showcase');

  useEffect(() => {
    // 等待认证状态加载完成后再加载数据
    if (!authLoading) {
      loadUsers();
    }
  }, [authLoading]);

  const loadUsers = async () => {
    try {
      const response = await authApi.getUsers();
      setUsers(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error('加载用户失败:', err);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('确定要删除这个用户吗？')) {
      try {
        await authApi.deleteUser(id);
        loadUsers();
      } catch (err) {
        alert(err.response?.data?.error || '删除失败');
      }
    }
  };

  if (loading || authLoading) return <div className="loading">加载中...</div>;

  return (
    <div className="admin">
      <div className="container">
        <h1>管理后台</h1>

        <div className="admin-tabs">
          <button
            className={`admin-tab ${activeTab === 'showcase' ? 'active' : ''}`}
            onClick={() => setActiveTab('showcase')}
          >
            首页展示
          </button>
          <button
            className={`admin-tab ${activeTab === 'ai-config' ? 'active' : ''}`}
            onClick={() => setActiveTab('ai-config')}
          >
            AI 配置
          </button>
          <button
            className={`admin-tab ${activeTab === 'repositories' ? 'active' : ''}`}
            onClick={() => setActiveTab('repositories')}
          >
            仓库管理
          </button>
          <button
            className={`admin-tab ${activeTab === 'endpoints' ? 'active' : ''}`}
            onClick={() => setActiveTab('endpoints')}
          >
            端口管理
          </button>
          <button
            className={`admin-tab ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            用户管理
          </button>
          <button
            className={`admin-tab ${activeTab === 'backup' ? 'active' : ''}`}
            onClick={() => setActiveTab('backup')}
          >
            数据备份
          </button>
        </div>

        {activeTab === 'showcase' && <HomeShowcaseSettings />}

        {activeTab === 'ai-config' && <AiConfigSettings />}

        {activeTab === 'repositories' && <RepositoryManagement />}

        {activeTab === 'endpoints' && <EndpointManagement />}

        {activeTab === 'backup' && <DataBackupSettings />}

        {activeTab === 'users' && (
          <div className="admin-section">
            <h2>用户管理</h2>
            <div className="users-table card">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>用户名</th>
                    <th>管理员</th>
                    <th>创建时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>{user.id}</td>
                      <td>{user.username}</td>
                      <td>{user.is_admin ? '是' : '否'}</td>
                      <td>{formatBeijingDateTime(user.created_at)}</td>
                      <td>
                        {user.id !== 1 && (
                          <button onClick={() => handleDelete(user.id)} className="btn btn-danger btn-sm">
                            删除
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin;
