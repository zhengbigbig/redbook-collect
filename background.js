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
      
      // 【关键修改】确保图片按顺序处理和上传
      for (let i = 0; i < imageBlobs.length; i++) {
        try {
          console.log(`\n🔄 正在处理第${i + 1}张图片 (${i + 1}/${imageBlobs.length}): ${imageBlobs[i].filename}`);
          console.log(`📊 当前图片信息: 大小 ${(imageBlobs[i].size / 1024).toFixed(2)}KB, 类型 ${imageBlobs[i].type}`);
          
          // 【调试】接收到的base64数据信息
          console.log(`=== 第${i + 1}张图片 接收到的Base64数据 ===`);
          console.log(`图片${i + 1} 接收到的Base64 (前100字符):`, imageBlobs[i].data.substring(0, 100));
          console.log(`图片${i + 1} 接收到的Base64长度:`, imageBlobs[i].data.length);
          console.log(`图片${i + 1} 图片类型:`, imageBlobs[i].type, '大小:', (imageBlobs[i].size / 1024).toFixed(2), 'KB');
          
          // 将base64转换为Blob
          const blob = base64ToBlob(imageBlobs[i].data, imageBlobs[i].type);
          
          // 【调试】转换后的Blob信息
          console.log(`=== 第${i + 1}张图片 Base64转换为Blob后 ===`);
          console.log(`图片${i + 1} 转换后的Blob 类型:`, blob.type, '大小:', (blob.size / 1024).toFixed(2), 'KB');
          
          // 验证转换后的Blob大小是否合理
          if (blob.size !== imageBlobs[i].size) {
            console.warn(`⚠️ 图片${i + 1} 转换后大小不匹配！原始: ${imageBlobs[i].size}, 转换后: ${blob.size}`);
          } else {
            console.log(`✅ 图片${i + 1} Base64转Blob成功，大小匹配`);
          }
          
          // 【调试】再次验证转换后的Blob的base64
          const verifyBase64 = await blobToBase64(blob);
          const isIdentical = verifyBase64 === imageBlobs[i].data;
          console.log(`图片${i + 1} 转换验证 - Base64是否一致:`, isIdentical);
          if (!isIdentical) {
            console.warn(`⚠️ 图片${i + 1} Base64转换过程中可能出现问题！`);
            console.log(`原始Base64长度: ${imageBlobs[i].data.length}, 验证Base64长度: ${verifyBase64.length}`);
          }
          
          console.log(`📤 正在上传第${i + 1}张图片到飞书 (按顺序上传)...`);
          
          // 【关键】按顺序上传到飞书，等待当前图片上传完成再处理下一张
          const fileToken = await uploadImageToFeishu(accessToken, blob, imageBlobs[i].filename, parentNode);
          
          // 【关键】按照原始顺序添加到附件数组
          imageAttachments.push({
            file_token: fileToken,
            // 添加额外信息用于调试和验证顺序
            originalIndex: i,
            filename: imageBlobs[i].filename,
            originalUrl: imageBlobs[i].originalUrl
          });
          
          console.log(`✅ 第${i + 1}张图片上传成功，文件名: ${imageBlobs[i].filename}`);
          console.log(`📋 当前已上传图片数量: ${imageAttachments.length}/${imageBlobs.length}`);
          
          // 添加短暂延迟，确保服务器有时间处理
          if (i < imageBlobs.length - 1) {
            console.log('⏳ 等待500ms后处理下一张图片...');
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          
        } catch (error) {
          console.error(`❌ 处理第${i + 1}张图片失败:`, error);
          console.log(`⚠️ 第${i + 1}张图片处理失败，跳过此图片但继续处理下一张`);
          // 【修复】失败的图片不添加到附件数组中，保持成功图片的相对顺序
          // 继续处理下一张图片，不中断整个流程
        }
      }
      
      // 【调试】打印最终的附件顺序
      console.log('\n📋 最终图片上传顺序验证:');
      imageAttachments.forEach((attachment, index) => {
        const status = attachment.failed ? '❌ 失败' : '✅ 成功';
        console.log(`${index + 1}. ${attachment.filename} - ${status} (原始位置: ${attachment.originalIndex + 1})`);
      });
      
      // 【修复】过滤掉失败的图片，只保留成功上传的，但保持原有顺序
      const successfulAttachments = imageAttachments.filter(attachment => !attachment.failed);
      console.log(`\n📊 上传结果统计: ${successfulAttachments.length}/${imageBlobs.length} 张图片成功上传`);
      
      // 【关键修复】确保最终的附件数组保持原有顺序
      imageAttachments = successfulAttachments.map(attachment => ({
        file_token: attachment.file_token
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
