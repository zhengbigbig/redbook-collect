document.addEventListener('DOMContentLoaded', function() {
  // 获取DOM元素
  const tableUrlInput = document.getElementById('tableUrl');
  const appTokenInput = document.getElementById('appToken');
  const appSecretInput = document.getElementById('appSecret');
  const saveConfigBtn = document.getElementById('saveConfig');
  const resetConfigBtn = document.getElementById('resetConfig');
  const statusMessage = document.getElementById('statusMessage');
  
  // 加载已保存的配置
  loadSavedConfig();
  
  // 保存配置按钮事件
  saveConfigBtn.addEventListener('click', function() {
    const tableUrl = tableUrlInput.value.trim();
    const appToken = appTokenInput.value.trim();
    const appSecret = appSecretInput.value.trim();
    
    if (!tableUrl || !appToken || !appSecret) {
      showStatus('请填写所有必要的配置信息', false);
      return;
    }
    
    // 解析表格URL获取app_token和table_id
    try {
      const urlParams = parseTableUrl(tableUrl);
      
      // 保存配置到Chrome存储
      chrome.storage.sync.set({
        tableUrl: tableUrl,
        appToken: appToken,
        appSecret: appSecret,
        baseAppToken: urlParams.appToken,
        tableId: urlParams.tableId
      }, function() {
        showStatus('配置已保存成功！现在可以关闭此页面，使用插件采集笔记了', true);
      });
    } catch (error) {
      showStatus(error.message, false);
    }
  });
  
  // 重置按钮事件
  resetConfigBtn.addEventListener('click', function() {
    tableUrlInput.value = '';
    appTokenInput.value = '';
    appSecretInput.value = '';
    statusMessage.style.display = 'none';
  });
  
  // 加载已保存的配置
  function loadSavedConfig() {
    chrome.storage.sync.get(['tableUrl', 'appToken', 'appSecret'], function(config) {
      tableUrlInput.value = config.tableUrl || '';
      appTokenInput.value = config.appToken || '';
      appSecretInput.value = config.appSecret || '';
    });
  }
  
  // 显示状态消息
  function showStatus(message, isSuccess) {
    statusMessage.textContent = message;
    statusMessage.className = 'status-message ' + (isSuccess ? 'success' : 'error');
    statusMessage.style.display = 'block';
    
    // 自动滚动到消息位置
    statusMessage.scrollIntoView({ behavior: 'smooth' });
  }
  
  // 解析表格URL
  function parseTableUrl(url) {
    try {
      // 示例URL: https://bytesmore.feishu.cn/base/UQxWbiiaSa7oqssbIxLclGeVnrV?table=tblQqWO7UfZ3JNTB&view=vewHNkTAcq
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      const baseAppToken = pathParts[pathParts.length - 1];
      
      const params = new URLSearchParams(urlObj.search);
      const tableId = params.get('table');
      
      if (!baseAppToken || !tableId) {
        throw new Error('无法从URL中解析出app_token或table_id');
      }
      
      return {
        appToken: baseAppToken,
        tableId: tableId
      };
    } catch (error) {
      throw new Error('表格URL格式不正确，无法解析');
    }
  }
});
