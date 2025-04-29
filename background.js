// 当插件图标被点击时，打开侧边栏
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({tabId: tab.id});
});

// 监听来自popup或侧边栏的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getFeishuToken') {
    // 获取飞书访问令牌
    getFeishuToken(message.appId, message.appSecret)
      .then(token => {
        sendResponse({ success: true, token: token });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    
    return true; // 表示会异步发送响应
  }
  
  if (message.action === 'submitToFeishu') {
    // 提交数据到飞书
    submitToFeishu(
      message.appToken,
      message.tableId,
      message.accessToken,
      message.data
    )
      .then(result => {
        sendResponse({ success: true, result: result });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    
    return true; // 表示会异步发送响应
  }
});

// 获取飞书访问令牌
function getFeishuToken(appId, appSecret) {
  return new Promise((resolve, reject) => {
    fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        app_id: appId,
        app_secret: appSecret
      })
    })
    .then(response => response.json())
    .then(data => {
      if (data.code === 0 && data.tenant_access_token) {
        resolve(data.tenant_access_token);
      } else {
        reject(new Error(data.msg || '获取飞书访问令牌失败'));
      }
    })
    .catch(error => {
      reject(new Error('网络请求失败: ' + error.message));
    });
  });
}

// 提交数据到飞书
function submitToFeishu(appToken, tableId, accessToken, data) {
  return new Promise((resolve, reject) => {
    fetch(`https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + accessToken
      },
      body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(result => {
      if (result.code === 0) {
        resolve(result);
      } else {
        reject(new Error(result.msg || '提交数据到飞书失败'));
      }
    })
    .catch(error => {
      reject(new Error('网络请求失败: ' + error.message));
    });
  });
}
