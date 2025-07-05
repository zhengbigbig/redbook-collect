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
  const useLastParamsBtn = document.getElementById('useLastParamsBtn');
  
  // 表单输入
  const tableUrlInput = document.getElementById('tableUrl');
  const appTokenInput = document.getElementById('appToken');
  const appSecretInput = document.getElementById('appSecret');
  const parentNodeInput = document.getElementById('parentNode');
  const categoryInput = document.getElementById('categoryInput');
  
  // 初始化界面
  initializeUI();
  
  // 保存配置按钮事件
  saveConfigBtn.addEventListener('click', function() {
    const tableUrl = tableUrlInput.value.trim();
    const appToken = appTokenInput.value.trim();
    const appSecret = appSecretInput.value.trim();
    const parentNode = parentNodeInput.value.trim();
    
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
        parentNode: parentNode,
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
    // 在采集前保存当前参数
    const currentParams = {
      category: document.getElementById('categoryInput').value.trim(),
      note: document.getElementById('noteText').value.trim(),
      keyword: document.getElementById('keywordText').value.trim()
    };
    
    // 保存到本地存储
    chrome.storage.local.set({
      lastParams: currentParams
    });
    
    showLoadingPanel('正在检查页面...');
    
    // 获取当前活动标签页
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const currentTab = tabs[0];
      
      chrome.tabs.sendMessage(currentTab.id, {action: "checkAndCollect"}, function(response) {
        if (chrome.runtime.lastError) {
          showResult('无法与页面通信，请确保您正在浏览小红书笔记页面', false);
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
        chrome.storage.sync.get(['appToken', 'appSecret', 'baseAppToken', 'tableId', 'parentNode'], function(config) {
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
              // 先检查是否有重复URL
              showLoadingPanel('正在检查是否已采集过...');
              return checkDuplicateUrl(config.baseAppToken, config.tableId, token, response.data.url)
                .then(duplicateResult => {
                  if (duplicateResult.isDuplicate) {
                    // 发现重复URL，显示确认对话框
                    return showDuplicateConfirmDialog()
                      .then(shouldContinue => {
                        if (shouldContinue) {
                          // 用户选择继续采集
                          return { token, shouldContinue: true };
                        } else {
                          // 用户选择取消采集
                          return { token, shouldContinue: false };
                        }
                      });
                  } else {
                    // 没有重复URL，继续采集
                    return { token, shouldContinue: true };
                  }
                });
            })
            .then(result => {
              if (!result.shouldContinue) {
                // 用户选择不继续采集
                showActionPanel('已取消采集');
                return;
              }
              
              const token = result.token;
              
              // 获取批注内容和关键词内容
              const noteText = document.getElementById('noteText').value.trim();
              const keywordText = document.getElementById('keywordText').value.trim();
              
              // 构建请求数据
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
                  "批注": noteText, // 添加批注字段
                  "关键词": keywordText, // 添加关键词字段
                  "分类": categoryInput.value
                }
              };
              
              // 检查是否有图片需要处理
              if (response.data.images && response.data.images.length > 0) {
                showLoadingPanel(`正在提取图片数据 (共${response.data.images.length}张)...`);
                
                // 先在content script中提取图片blob数据
                chrome.tabs.sendMessage(currentTab.id, {
                  action: "extractImageBlobs",
                  imageUrls: response.data.images
                }, function(blobResponse) {
                  if (chrome.runtime.lastError) {
                    showResult('图片数据提取失败: ' + chrome.runtime.lastError.message, false);
                    return;
                  }
                  
                  if (!blobResponse || !blobResponse.success) {
                    showResult('图片数据提取失败: ' + (blobResponse ? blobResponse.error : '未知错误'), false);
                    return;
                  }
                  
                  showLoadingPanel(`正在上传图片到飞书 (共${blobResponse.imageBlobs.length}张)...`);
                  
                  // 使用新的图片Blob处理方法，传递parentNode
                  processImageBlobsAndSubmitToFeishu(
                    config.baseAppToken, 
                    config.tableId, 
                    token, 
                    requestData, 
                    blobResponse.imageBlobs,
                    config.parentNode // 传递parentNode配置
                  )
                  .then(result => {
                    let message = '数据已成功提交到飞书多维表格';
                    
                    // 如果处理了图片，显示图片处理结果
                    if (result?.processedImages !== undefined) {
                      message += `\n图片处理结果: ${result.processedImages}/${result.totalImages} 张上传成功`;
                    }
                    
                    // 更新按钮状态
                    useLastParamsBtn.disabled = false;
                    useLastParamsBtn.textContent = '使用上一次参数';
                    
                    showResult(message, true);
                  })
                  .catch(error => {
                    showResult('提交数据失败: ' + error.message, false);
                  });
                });
              } else {
                // 没有图片，直接提交数据
                showLoadingPanel('正在提交数据到飞书...');
                submitToFeishu(config.baseAppToken, config.tableId, token, requestData)
                  .then(result => {
                    // 更新按钮状态
                    useLastParamsBtn.disabled = false;
                    useLastParamsBtn.textContent = '使用上一次参数';
                    
                    showResult('数据已成功提交到飞书多维表格', true);
                  })
                  .catch(error => {
                    showResult('提交数据失败: ' + error.message, false);
                  });
              }
            })
            .catch(error => {
              showResult('获取飞书访问令牌失败: ' + error.message, false);
            });
        });
      });
    });
  });
  
  // 使用上一次参数按钮事件
  useLastParamsBtn.addEventListener('click', function() {
    chrome.storage.local.get(['lastParams'], function(result) {
      if (result.lastParams) {
        // 回填上一次的参数
        document.getElementById('categoryInput').value = result.lastParams.category || '';
        document.getElementById('noteText').value = result.lastParams.note || '';
        document.getElementById('keywordText').value = result.lastParams.keyword || '';
        
        // 显示提示信息
        showActionPanel('已回填上一次使用的参数');
      } else {
        // 没有保存的参数
        showActionPanel('没有找到上一次使用的参数');
      }
    });
  });
  
  // 修改配置按钮事件
  configBtn.addEventListener('click', function() {
    chrome.runtime.openOptionsPage();
  });
  
  // 关闭按钮事件
  closeBtn.addEventListener('click', function() {
    // 清空表单内容
    document.getElementById('categoryInput').value = '';
    document.getElementById('noteText').value = '';
    document.getElementById('keywordText').value = '';
    
    showActionPanel(''); // 返回到操作面板
  });
  
  // 打开选项页面链接事件
  openOptionsPageLink.addEventListener('click', function(e) {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
  
  // 初始化界面
  function initializeUI() {
    chrome.storage.sync.get(['tableUrl', 'appToken', 'appSecret', 'parentNode'], function(config) {
      if (config.tableUrl && config.appToken && config.appSecret) {
        // 已有配置，显示操作面板
        tableUrlInput.value = config.tableUrl || '';
        appTokenInput.value = config.appToken || '';
        appSecretInput.value = config.appSecret || '';
        parentNodeInput.value = config.parentNode || '';
        
        // 检查是否有上一次的参数
        chrome.storage.local.get(['lastParams'], function(result) {
          if (result.lastParams) {
            showActionPanel('配置已完成，可以开始采集笔记');
            useLastParamsBtn.disabled = false;
            useLastParamsBtn.textContent = '使用上一次参数';
          } else {
            showActionPanel('配置已完成，可以开始采集笔记');
            useLastParamsBtn.disabled = true;
            useLastParamsBtn.textContent = '暂无历史参数';
          }
        });
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
    chrome.storage.sync.get(['tableUrl', 'appToken', 'appSecret', 'parentNode'], function(config) {
      tableUrlInput.value = config.tableUrl || '';
      appTokenInput.value = config.appToken || '';
      appSecretInput.value = config.appSecret || '';
      parentNodeInput.value = config.parentNode || '';
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
  
  // 处理图片Blob数据并提交数据到飞书
  function processImageBlobsAndSubmitToFeishu(appToken, tableId, accessToken, data, imageBlobs, parentNode) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          action: 'processImageBlobsAndSubmit',
          appToken: appToken,
          tableId: tableId,
          accessToken: accessToken,
          data: data,
          imageBlobs: imageBlobs,
          parentNode: parentNode
        },
        response => {
          if (chrome.runtime.lastError) {
            reject(new Error('通信错误: ' + chrome.runtime.lastError.message));
            return;
          }
          
          if (response.success) {
            resolve(response.result);
          } else {
            reject(new Error(response.error || '处理图片Blob数据和提交数据失败'));
          }
        }
      );
    });
  }
  
  // 检查是否有重复URL
  function checkDuplicateUrl(appToken, tableId, accessToken, url) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          action: 'checkDuplicateUrl',
          appToken: appToken,
          tableId: tableId,
          accessToken: accessToken,
          url: url
        },
        response => {
          if (chrome.runtime.lastError) {
            reject(new Error('通信错误: ' + chrome.runtime.lastError.message));
            return;
          }
          
          if (response.success) {
            resolve(response.result);
          } else {
            reject(new Error(response.error || '检查重复URL失败'));
          }
        }
      );
    });
  }
  
  // 显示重复URL确认对话框
  function showDuplicateConfirmDialog() {
    return new Promise((resolve) => {
      const dialog = document.createElement('div');
      dialog.className = 'confirm-dialog';
      dialog.innerHTML = `
        <div class="confirm-content">
          <h2>⚠️ 重复提醒</h2>
          <p>已采集过，是否继续采集？</p>
          <div class="button-group">
            <button class="confirm-no">取消采集</button>
            <button class="confirm-yes">继续采集</button>
          </div>
        </div>
      `;
      
      // 添加到body
      document.body.appendChild(dialog);
      
      // 获取按钮元素
      const confirmYes = dialog.querySelector('.confirm-yes');
      const confirmNo = dialog.querySelector('.confirm-no');
      
      // 绑定事件
      confirmYes.addEventListener('click', function() {
        document.body.removeChild(dialog);
        resolve(true);
      });
      
      confirmNo.addEventListener('click', function() {
        document.body.removeChild(dialog);
        resolve(false);
      });
      
      // 点击背景关闭对话框（默认取消）
      dialog.addEventListener('click', function(e) {
        if (e.target === dialog) {
          document.body.removeChild(dialog);
          resolve(false);
        }
      });
    });
  }
});
