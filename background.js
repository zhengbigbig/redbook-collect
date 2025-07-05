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
  
  if (message.action === 'checkDuplicateUrl') {
    // 检查重复URL
    checkDuplicateUrl(
      message.appToken,
      message.tableId,
      message.accessToken,
      message.url
    )
      .then(result => {
        sendResponse({ success: true, result: result });
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
  
  if (message.action === 'processImageBlobsAndSubmit') {
    // 处理图片Blob数据并提交数据到飞书
    processImageBlobsAndSubmitToFeishu(
      message.appToken,
      message.tableId,
      message.accessToken,
      message.data,
      message.imageBlobs,
      message.parentNode
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

// 处理图片Blob数据并提交到飞书
async function processImageBlobsAndSubmitToFeishu(appToken, tableId, accessToken, data, imageBlobs, parentNode) {
  try {
    let imageAttachments = [];
    
    if (imageBlobs && imageBlobs.length > 0) {
      console.log('开始处理图片Base64数据，共', imageBlobs.length, '张');
      console.log('📋 图片处理顺序:', imageBlobs.map((blob, index) => `${index + 1}. ${blob.filename}`));
      
      // 【关键修改】使用Promise.all并发上传图片，但保持顺序
      console.log('🚀 开始并发上传图片到飞书...');
      
      // 创建上传任务数组，每个任务都包含原始索引信息
      const uploadTasks = imageBlobs.map(async (imageBlob, index) => {
        try {
          console.log(`\n🔄 准备上传第${index + 1}张图片: ${imageBlob.filename}`);
          console.log(`📊 图片${index + 1}信息: 大小 ${(imageBlob.size / 1024).toFixed(2)}KB, 类型 ${imageBlob.type}`);
          
          // 【调试】接收到的base64数据信息
          console.log(`=== 第${index + 1}张图片 接收到的Base64数据 ===`);
          console.log(`图片${index + 1} 接收到的Base64 (前100字符):`, imageBlob.data.substring(0, 100));
          console.log(`图片${index + 1} 接收到的Base64长度:`, imageBlob.data.length);
          console.log(`图片${index + 1} 图片类型:`, imageBlob.type, '大小:', (imageBlob.size / 1024).toFixed(2), 'KB');
          
          // 将base64转换为Blob
          const blob = base64ToBlob(imageBlob.data, imageBlob.type);
          
          // 【调试】转换后的Blob信息
          console.log(`=== 第${index + 1}张图片 Base64转换为Blob后 ===`);
          console.log(`图片${index + 1} 转换后的Blob 类型:`, blob.type, '大小:', (blob.size / 1024).toFixed(2), 'KB');
          
          // 验证转换后的Blob大小是否合理
          if (blob.size !== imageBlob.size) {
            console.warn(`⚠️ 图片${index + 1} 转换后大小不匹配！原始: ${imageBlob.size}, 转换后: ${blob.size}`);
          } else {
            console.log(`✅ 图片${index + 1} Base64转Blob成功，大小匹配`);
          }
          
          // 【调试】再次验证转换后的Blob的base64
          const verifyBase64 = await blobToBase64(blob);
          const isIdentical = verifyBase64 === imageBlob.data;
          console.log(`图片${index + 1} 转换验证 - Base64是否一致:`, isIdentical);
          if (!isIdentical) {
            console.warn(`⚠️ 图片${index + 1} Base64转换过程中可能出现问题！`);
            console.log(`原始Base64长度: ${imageBlob.data.length}, 验证Base64长度: ${verifyBase64.length}`);
          }
          
          console.log(`📤 正在上传第${index + 1}张图片到飞书 (并发上传)...`);
          
          // 上传到飞书
          const fileToken = await uploadImageToFeishu(accessToken, blob, imageBlob.filename, parentNode);
          
          // 返回包含原始索引的结果
          return {
            success: true,
            originalIndex: index,
            file_token: fileToken,
            filename: imageBlob.filename,
            originalUrl: imageBlob.originalUrl
          };
          
        } catch (error) {
          console.error(`❌ 上传第${index + 1}张图片失败:`, error);
          
          // 返回失败结果，但保持原始索引
          return {
            success: false,
            originalIndex: index,
            filename: imageBlob.filename,
            originalUrl: imageBlob.originalUrl,
            error: error.message
          };
        }
      });
      
      // 【关键】使用Promise.all等待所有上传任务完成
      console.log(`⏳ 等待所有 ${uploadTasks.length} 张图片并发上传完成...`);
      const uploadResults = await Promise.all(uploadTasks);
      
      // 【关键】按原始索引顺序排序结果，确保顺序正确
      const sortedResults = uploadResults.sort((a, b) => a.originalIndex - b.originalIndex);
      
      // 【调试】打印上传结果和顺序验证
      console.log('\n📋 图片上传结果顺序验证:');
      sortedResults.forEach((result, index) => {
        const status = result.success ? '✅ 成功' : '❌ 失败';
        console.log(`${index + 1}. ${result.filename} - ${status} (原始位置: ${result.originalIndex + 1})`);
        if (result.success) {
          console.log(`   file_token: ${result.file_token}`);
        } else {
          console.log(`   错误: ${result.error}`);
        }
      });
      
      // 过滤出成功上传的图片
      const successfulResults = sortedResults.filter(result => result.success);
      console.log(`\n📊 上传结果统计: ${successfulResults.length}/${imageBlobs.length} 张图片成功上传`);
      
      // 【关键】按顺序构建最终的附件数组
      imageAttachments = successfulResults.map(result => ({
        file_token: result.file_token
      }));
      
      // 【调试】打印最终附件的file_token顺序
      console.log('\n📋 最终附件file_token顺序:');
      imageAttachments.forEach((attachment, index) => {
        console.log(`${index + 1}. file_token: ${attachment.file_token}`);
      });
    }
    
    // 将图片附件添加到数据中
    if (imageAttachments.length > 0) {
      data.fields['附件'] = imageAttachments;
      console.log(`📎 添加 ${imageAttachments.length} 个图片附件到数据中`);
    } else {
      console.log('📎 没有成功上传的图片附件');
    }
    
    // 提交数据到飞书多维表格
    console.log('📤 正在提交数据到飞书多维表格...');
    const result = await submitToFeishu(appToken, tableId, accessToken, data);
    
    return {
      ...result,
      processedImages: imageAttachments.length,
      totalImages: imageBlobs ? imageBlobs.length : 0
    };
    
  } catch (error) {
    throw new Error('处理图片Base64数据和提交数据失败: ' + error.message);
  }
}

// 【新增】将Base64转换为Blob的辅助函数
function base64ToBlob(base64, mimeType) {
  // 解码base64
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

// 【新增】将Blob转换为Base64的辅助函数
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // 去掉data:image/jpeg;base64,前缀，只保留base64数据
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// 上传图片到飞书
async function uploadImageToFeishu(accessToken, imageBlob, filename, parentNode) {
  try {
    console.log(`📤 准备上传图片: ${filename}`, {
      size: imageBlob.size,
      type: imageBlob.type,
      sizeKB: (imageBlob.size / 1024).toFixed(2) + 'KB'
    });
    
    // 【调试】在上传到飞书前，最后一次检查图片的base64
    console.log(`=== 上传到飞书前最终检查 ${filename} ===`);
    const finalBlobBase64 = await blobToBase64(imageBlob);
    console.log(`${filename} 最终上传的Blob Base64 (前100字符):`, finalBlobBase64.substring(0, 100));
    console.log(`${filename} 最终上传的Blob Base64长度:`, finalBlobBase64.length);
    console.log(`${filename} 最终上传的Blob 详细信息:`, {
      size: imageBlob.size,
      type: imageBlob.type,
      sizeKB: (imageBlob.size / 1024).toFixed(2)
    });
    
    const formData = new FormData();
    formData.append('file', imageBlob, filename);
    formData.append('file_name', filename);
    formData.append('parent_type', 'bitable_image'); // 多维表格图片类型
    formData.append('size', imageBlob.size.toString());
    if (parentNode) {
      formData.append('parent_node', parentNode);
    }
    
    // 【调试】打印FormData的详细信息
    console.log(`${filename} FormData创建完成，包含字段:`, {
      file: '图片文件',
      file_name: filename,
      parent_type: 'bitable_image',
      size: imageBlob.size.toString(),
      parent_node: parentNode || '未设置'
    });
    
    // 记录上传开始时间
    const uploadStartTime = Date.now();
    console.log(`⏱️ ${filename} 开始上传，时间: ${new Date().toLocaleTimeString()}`);
    
    // 可选的extra参数，用于指定存储位置等
    // formData.append('extra', JSON.stringify({}));
    
    const response = await fetch('https://open.feishu.cn/open-apis/drive/v1/medias/upload_all', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        // 注意：不要手动设置Content-Type，让浏览器自动设置multipart/form-data边界
      },
      body: formData
    });
    
    const result = await response.json();
    
    // 计算上传耗时
    const uploadTime = Date.now() - uploadStartTime;
    console.log(`⏱️ ${filename} 上传完成，耗时: ${uploadTime}ms`);
    
    console.log(`${filename} 飞书上传响应:`, result);
    
    if (result.code === 0 && result.data && result.data.file_token) {
      console.log(`✅ ${filename} 图片上传成功，file_token:`, result.data.file_token);
      console.log(`📊 ${filename} 上传统计: 大小 ${(imageBlob.size / 1024).toFixed(2)}KB, 耗时 ${uploadTime}ms`);
      return result.data.file_token;
    } else {
      console.error(`❌ ${filename} 上传失败，飞书返回:`, result);
      throw new Error(result.msg || '上传图片到飞书失败');
    }
  } catch (error) {
    console.error(`❌ ${filename} 上传图片到飞书详细错误:`, error);
    throw new Error('上传图片到飞书失败: ' + error.message);
  }
}

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
    const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records`;
    
    fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
      if (data.code === 0) {
        resolve(data.data);
      } else {
        reject(new Error(data.msg || '提交数据失败'));
      }
    })
    .catch(error => {
      reject(error);
    });
  });
}

// 检查重复URL
function checkDuplicateUrl(appToken, tableId, accessToken, url) {
  return new Promise((resolve, reject) => {
    const apiUrl = `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/search`;
    
    const searchData = {
      automatic_fields: false,
      field_names: ["标题", "url"],
      filter: {
        conditions: [
          {
            field_name: "url",
            operator: "is",
            value: [url]
          }
        ],
        conjunction: "and"
      },
      page_size: 1
    };
    
    console.log('🔍 正在查询重复URL:', url);
    console.log('📋 查询参数:', JSON.stringify(searchData, null, 2));
    
    fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(searchData)
    })
    .then(response => response.json())
    .then(data => {
      console.log('🔍 查询结果:', data);
      
      if (data.code === 0) {
        const records = data.data?.items || [];
        const isDuplicate = records.length > 0;
        
        console.log(`📊 查询完成 - URL"${url}"${isDuplicate ? '已存在' : '不存在'}`);
        
        resolve({
          isDuplicate: isDuplicate,
          existingRecords: records,
          url: url
        });
      } else {
        console.error('❌ 查询失败:', data.msg);
        reject(new Error(data.msg || '查询重复URL失败'));
      }
    })
    .catch(error => {
      console.error('❌ 查询请求失败:', error);
      reject(error);
    });
  });
}
