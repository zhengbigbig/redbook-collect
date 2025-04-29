document.addEventListener('DOMContentLoaded', function() {
  // 获取DOM元素
  const configForm = document.getElementById('configForm');
  const actionPanel = document.getElementById('actionPanel');
  const loadingPanel = document.getElementById('loadingPanel');
  const resultPanel = document.getElementById('resultPanel');
  const status = document.getElementById('status');
  const resultMessage = document.getElementById('resultMessage');
  
  // 按钮
  const saveConfigBtn = document.getElementById('saveConfig');
  const collectBtn = document.getElementById('collectBtn');
  const configBtn = document.getElementById('configBtn');
  const closeBtn = document.getElementById('closeBtn');
  const openOptionsPageLink = document.getElementById('openOptionsPage');
  
  // 表单输入
  const tableUrlInput = document.getElementById('tableUrl');
  const appTokenInput = document.getElementById('appToken');
  const appSecretInput = document.getElementById('appSecret');
  
  // 初始化界面
  initializeUI();
  
  // 保存配置按钮事件
  saveConfigBtn.addEventListener('click', function() {
    const tableUrl = tableUrlInput.value.trim();
    const appToken = appTokenInput.value.trim();
    const appSecret = appSecretInput.value.trim();
    
    if (!tableUrl || !appToken || !appSecret) {
      showResult('请填写所有必要的配置信息', false);
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
        showActionPanel('配置已保存，现在可以采集笔记了');
      });
    } catch (error) {
      showResult(error.message, false);
    }
  });
  
  // 采集按钮事件
  collectBtn.addEventListener('click', function() {
    showLoadingPanel('正在检查页面...');
    
    // 向当前标签页发送消息，检查是否是小红书笔记页面并采集数据
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {action: "checkAndCollect"}, function(response) {
        if (chrome.runtime.lastError) {
          showResult('无法与页面通信，请刷新页面后重试', false);
          return;
        }
        
        if (!response) {
          showResult('无法获取页面信息，请刷新页面后重试', false);
          return;
        }
        
        if (!response.isNotePage) {
          showResult('当前页面不是小红书笔记详情页，请打开一篇笔记后再试', false);
          return;
        }
        
        // 获取配置信息
        chrome.storage.sync.get(['appToken', 'appSecret', 'baseAppToken', 'tableId'], function(config) {
          if (chrome.runtime.lastError) {
            showResult('获取配置信息失败', false);
            return;
          }
          
          if (!config.appToken || !config.appSecret || !config.baseAppToken || !config.tableId) {
            showResult('配置信息不完整，请重新配置', false);
            return;
          }
          
          // 获取飞书访问令牌
          showLoadingPanel('正在获取飞书访问令牌...');
          getFeishuToken(config.appToken, config.appSecret)
            .then(token => {
              // 获取批注内容
              const noteText = document.getElementById('noteText').value.trim();
              
              // 构建请求数据
              showLoadingPanel('正在提交数据到飞书...');
              const requestData = {
                fields: {
                  "url": response.data.url,
                  "标题": response.data.title,
                  "作者": response.data.author,
                  "正文": response.data.content,
                  "标签": response.data.tags,
                  "点赞": response.data.likes,
                  "收藏": response.data.collects,
                  "评论": response.data.comments,
                  "批注": noteText // 添加批注字段
                }
              };
              
              // 提交数据到飞书
              return submitToFeishu(config.baseAppToken, config.tableId, token, requestData);
            })
            .then(result => {
              showResult('数据已成功提交到飞书多维表格', true);
            })
            .catch(error => {
              showResult('提交数据失败: ' + error.message, false);
            });
        });
      });
    });
  });
  
  // 修改配置按钮事件
  configBtn.addEventListener('click', function() {
    chrome.runtime.openOptionsPage();
  });
  
  // 关闭按钮事件
  closeBtn.addEventListener('click', function() {
    window.close();
  });
  
  // 打开选项页面链接事件
  openOptionsPageLink.addEventListener('click', function(e) {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
  
  // 初始化界面
  function initializeUI() {
    chrome.storage.sync.get(['tableUrl', 'appToken', 'appSecret'], function(config) {
      if (config.tableUrl && config.appToken && config.appSecret) {
        // 已有配置，显示操作面板
        tableUrlInput.value = config.tableUrl || '';
        appTokenInput.value = config.appToken || '';
        appSecretInput.value = config.appSecret || '';
        showActionPanel('配置已完成，可以开始采集笔记');
      } else {
        // 无配置，显示配置表单
        showConfigForm();
      }
    });
  }
  
  // 显示配置表单
  function showConfigForm() {
    configForm.style.display = 'block';
    actionPanel.style.display = 'none';
    loadingPanel.style.display = 'none';
    resultPanel.style.display = 'none';
    
    // 加载已保存的配置
    chrome.storage.sync.get(['tableUrl', 'appToken', 'appSecret'], function(config) {
      tableUrlInput.value = config.tableUrl || '';
      appTokenInput.value = config.appToken || '';
      appSecretInput.value = config.appSecret || '';
    });
  }
  
  // 显示操作面板
  function showActionPanel(statusText) {
    configForm.style.display = 'none';
    actionPanel.style.display = 'block';
    loadingPanel.style.display = 'none';
    resultPanel.style.display = 'none';
    
    if (statusText) {
      status.textContent = statusText;
    }
  }
  
  // 显示加载面板
  function showLoadingPanel(loadingText) {
    configForm.style.display = 'none';
    actionPanel.style.display = 'none';
    loadingPanel.style.display = 'block';
    resultPanel.style.display = 'none';
    
    document.getElementById('loadingText').textContent = loadingText || '正在处理...';
  }
  
  // 显示结果面板
  function showResult(message, isSuccess) {
    configForm.style.display = 'none';
    actionPanel.style.display = 'none';
    loadingPanel.style.display = 'none';
    resultPanel.style.display = 'block';
    
    resultMessage.textContent = message;
    resultMessage.className = 'result-message ' + (isSuccess ? 'success' : 'error');
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
  
  // 获取飞书访问令牌
  function getFeishuToken(appId, appSecret) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          action: 'getFeishuToken',
          appId: appId,
          appSecret: appSecret
        },
        response => {
          if (chrome.runtime.lastError) {
            reject(new Error('通信错误: ' + chrome.runtime.lastError.message));
            return;
          }
          
          if (response.success) {
            resolve(response.token);
          } else {
            reject(new Error(response.error || '获取飞书访问令牌失败'));
          }
        }
      );
    });
  }
  
  // 提交数据到飞书
  function submitToFeishu(appToken, tableId, accessToken, data) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          action: 'submitToFeishu',
          appToken: appToken,
          tableId: tableId,
          accessToken: accessToken,
          data: data
        },
        response => {
          if (chrome.runtime.lastError) {
            reject(new Error('通信错误: ' + chrome.runtime.lastError.message));
            return;
          }
          
          if (response.success) {
            resolve(response.result);
          } else {
            reject(new Error(response.error || '提交数据到飞书失败'));
          }
        }
      );
    });
  }
});
