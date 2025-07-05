// 监听来自popup的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "checkAndCollect") {
    // 检查当前页面是否是小红书笔记详情页
    const isNotePage = document.querySelector('div[id="noteContainer"]') !== null;
    
    if (!isNotePage) {
      sendResponse({
        isNotePage: false
      });
      return true;
    }
    
    // 提取笔记信息
    try {
      collectNoteDataAsync().then(data => {
        sendResponse({
          isNotePage: true,
          data: data
        });
      }).catch(error => {
        console.error('提取笔记数据出错:', error);
        sendResponse({
          isNotePage: true,
          error: error.message
        });
      });
    } catch (error) {
      console.error('提取笔记数据出错:', error);
      sendResponse({
        isNotePage: true,
        error: error.message
      });
    }
    
    return true;
  }
  
  if (request.action === "extractImageBlobs") {
    // 提取图片Blob数据
    extractImageBlobs(request.imageUrls).then(imageBlobs => {
      sendResponse({
        success: true,
        imageBlobs: imageBlobs
      });
    }).catch(error => {
      sendResponse({
        success: false,
        error: error.message
      });
    });
    
    return true;
  }
});

// 异步提取笔记数据
async function collectNoteDataAsync() {
  // 提取页面URL
  const url = window.location.href;
  
  // 提取作者用户名
  const usernameElement = document.querySelector('span.username');
  const username = usernameElement ? usernameElement.textContent.trim() : '';
  
  // 提取标题 - 修正选择器
  const titleElement = document.querySelector('div.interaction-container div.note-scroller div.note-content div.title');
  const title = titleElement ? titleElement.textContent.trim() : '';
  
  // 提取正文内容 - 修正选择器
  const noteTextElement = document.querySelector('div.interaction-container div.note-scroller div.note-content div.desc span.note-text > span');
  const content = noteTextElement ? noteTextElement.textContent.trim() : '';
  
  // 提取标签
  const tagElements = document.querySelectorAll('a.tag');
  const tags = Array.from(tagElements).map(tag => tag.textContent.trim());
  
  // 提取点赞数 - 修正选择器
  const likeCountElement = document.querySelector('div.interaction-container div.interactions div.engage-bar-container div.engage-bar div.input-box div.interact-container div.left span.like-wrapper span.count');
  const likes = likeCountElement ? parseInt(likeCountElement.textContent.trim()) || 0 : 0;
  
  // 提取收藏数 - 修正选择器
  const collectCountElement = document.querySelector('div.interaction-container div.interactions div.engage-bar-container div.engage-bar div.input-box div.interact-container div.left span.collect-wrapper span.count');
  const collects = collectCountElement ? parseInt(collectCountElement.textContent.trim()) || 0 : 0;
  
  // 提取评论数 - 修正选择器
  const chatCountElement = document.querySelector('div.interaction-container div.interactions div.engage-bar-container div.engage-bar div.input-box div.interact-container div.left span.chat-wrapper span.count');
  const comments = chatCountElement ? parseInt(chatCountElement.textContent.trim()) || 0 : 0;
  
  // 提取图片URLs
  const images = await extractImages();
  
  // 添加调试信息
  console.log('提取的笔记数据:', {
    url,
    author: username,
    title,
    content,
    tags,
    likes,
    collects,
    comments,
    images
  });
  
  return {
    url,
    author: username,
    title,
    content,
    tags,
    likes,
    collects,
    comments,
    images
  };
}

// 提取图片URLs
async function extractImages() {
  const imageUrls = [];
  const imageMap = new Map(); // 用于去重，key为文件名，value为图片信息
  
  try {
    // 【关键修复】按照data-index属性值排序提取图片，并根据文件名去重
    // 查询：.swiper .swiper-wrapper 下所有子节点的 .swiper-slide .img-container img
    const swiperWrapper = document.querySelector('.swiper .swiper-wrapper');
    
    if (swiperWrapper) {
      console.log('找到轮播容器 .swiper .swiper-wrapper');
      
      // 获取所有swiper-slide节点
      const slideElements = Array.from(swiperWrapper.querySelectorAll('.swiper-slide'));
      console.log('轮播容器中的swiper-slide数量:', slideElements.length);
      
      // 【关键修复】按照data-index属性值排序
      const slidesWithIndex = slideElements.map(slide => {
        const dataIndex = slide.getAttribute('data-index');
        const index = dataIndex ? parseInt(dataIndex) : 999; // 没有data-index的放到最后
        return {
          slide: slide,
          index: index,
          dataIndex: dataIndex
        };
      }).sort((a, b) => a.index - b.index); // 按data-index从小到大排序
      
      console.log('排序后的slide信息:');
      slidesWithIndex.forEach((item, i) => {
        console.log(`  ${i + 1}. data-index="${item.dataIndex}" (排序值: ${item.index})`);
      });
      
      // 按照排序后的顺序提取图片
      slidesWithIndex.forEach((item, index) => {
        const slide = item.slide;
        const dataIndex = item.dataIndex;
        
        // 在 swiper-slide 中查找 .img-container img
        const img = slide.querySelector('.img-container img');
        
        if (img) {
          const src = img.src || img.getAttribute('src');
          if (src) {
            // 提取原图URL，去掉缩略图后缀
            const originalUrl = src.replace(/!.*$/, '');
            const fileName = originalUrl.split('/').pop(); // 获取文件名
            
            // 【关键】使用文件名作为key进行去重，保留data-index最小的
            if (!imageMap.has(fileName) || parseInt(dataIndex) < imageMap.get(fileName).dataIndex) {
              imageMap.set(fileName, {
                url: originalUrl,
                dataIndex: parseInt(dataIndex),
                fileName: fileName,
                slideIndex: index
              });
              console.log(`图片${index + 1} (data-index="${dataIndex}", 文件名="${fileName}"):`, originalUrl);
              console.log(`  - 节点类名:`, slide.className);
              console.log(`  - 图片路径:`, img.src);
            } else {
              console.log(`图片重复跳过 (data-index="${dataIndex}", 文件名="${fileName}"):`, originalUrl);
            }
          }
        } else {
          console.log(`data-index="${dataIndex}"的swiper-slide中未找到 .img-container img`);
        }
      });
      
      console.log(`通过data-index排序方法找到 ${imageMap.size} 张唯一图片`);
    } else {
      console.log('未找到 .swiper .swiper-wrapper 容器，尝试备用方案');
      
      // 备用方案：尝试其他可能的选择器
      const fallbackSelectors = [
        '.slider-container .swiper-slide',
        '.swiper-wrapper .swiper-slide',
        '.swiper-slide'
      ];
      
      for (const selector of fallbackSelectors) {
        const slideElements = document.querySelectorAll(selector);
        if (slideElements.length > 0) {
          console.log(`使用备用选择器找到 ${slideElements.length} 个slide:`, selector);
          
          // 同样按照data-index排序和去重
          const slidesArray = Array.from(slideElements);
          const slidesWithIndex = slidesArray.map(slide => {
            const dataIndex = slide.getAttribute('data-index');
            const index = dataIndex ? parseInt(dataIndex) : 999;
            return {
              slide: slide,
              index: index,
              dataIndex: dataIndex
            };
          }).sort((a, b) => a.index - b.index);
          
          slidesWithIndex.forEach((item, index) => {
            const slide = item.slide;
            const dataIndex = item.dataIndex;
            
            const img = slide.querySelector('.img-container img') || slide.querySelector('img');
            if (img) {
              const src = img.src || img.getAttribute('src');
              if (src) {
                const originalUrl = src.replace(/!.*$/, '');
                const fileName = originalUrl.split('/').pop();
                
                if (!imageMap.has(fileName) || parseInt(dataIndex) < imageMap.get(fileName).dataIndex) {
                  imageMap.set(fileName, {
                    url: originalUrl,
                    dataIndex: parseInt(dataIndex),
                    fileName: fileName,
                    slideIndex: index
                  });
                  console.log(`备用方案图片${index + 1} (data-index="${dataIndex}", 文件名="${fileName}"):`, originalUrl);
                } else {
                  console.log(`备用方案图片重复跳过 (data-index="${dataIndex}", 文件名="${fileName}"):`, originalUrl);
                }
              }
            }
          });
          
          break; // 找到一个有效的选择器就停止
        }
      }
    }
    
    // 【关键】将Map转换为数组，并按data-index排序
    const sortedImages = Array.from(imageMap.values()).sort((a, b) => a.dataIndex - b.dataIndex);
    
    // 提取最终的URL数组
    sortedImages.forEach((imageInfo, index) => {
      imageUrls.push(imageInfo.url);
    });
    
    console.log('📋 去重排序后的图片信息:');
    sortedImages.forEach((imageInfo, index) => {
      console.log(`${index + 1}. data-index="${imageInfo.dataIndex}" 文件名="${imageInfo.fileName}"`);
    });
    
    console.log('📋 最终提取到的图片URLs顺序:', imageUrls.map((url, index) => `${index + 1}. ${url.split('/').pop()}`));
    console.log('提取到的图片URLs:', imageUrls);
    return imageUrls;
    
  } catch (error) {
    console.error('提取图片URLs失败:', error);
    return [];
  }
}

// 在页面环境中通过img元素提取图片Blob数据
async function extractImageBlobs(imageUrls) {
  const imageBlobs = [];
  
  if (!imageUrls || imageUrls.length === 0) {
    return imageBlobs;
  }
  
  console.log('开始在页面环境中通过img元素提取图片Blob数据，共', imageUrls.length, '张');
  console.log('📋 图片URL顺序:', imageUrls.map((url, index) => `${index + 1}. ${url.split('/').pop()}`));
  
  // 【关键】使用for循环确保按顺序处理，而不是并发处理
  for (let i = 0; i < imageUrls.length; i++) {
    try {
      console.log(`\n🔄 正在处理第${i + 1}张图片 (${i + 1}/${imageUrls.length}):`, imageUrls[i]);
      
      const imageBlob = await loadImageAsBlob(imageUrls[i]);
      
      if (imageBlob) {
        // 【调试】在转换base64前，先打印blob信息
        console.log(`=== 第${i + 1}张图片 Blob获取成功后的信息 ===`);
        console.log(`图片${i + 1} Blob 类型:`, imageBlob.type, '大小:', (imageBlob.size / 1024).toFixed(2), 'KB');
        
        // 直接将Blob转换为base64，不再使用ArrayBuffer
        const blobBase64 = await blobToBase64(imageBlob);
        console.log(`图片${i + 1} Blob Base64 (前100字符):`, blobBase64.substring(0, 100));
        console.log(`图片${i + 1} Blob 完整 Base64长度:`, blobBase64.length);
        
        // 【调试】验证base64数据的完整性
        if (blobBase64 && blobBase64.length > 0) {
          console.log(`✅ 图片${i + 1} Base64数据生成成功`);
        } else {
          console.warn(`⚠️ 图片${i + 1} Base64数据生成失败或为空`);
        }
        
        // 【关键】确保按顺序添加到数组，包含原始索引信息
        const imageData = {
          data: blobBase64, // 直接使用base64字符串
          type: imageBlob.type || 'image/jpeg',
          size: imageBlob.size,
          filename: `image_${i + 1}.${getFileExtensionFromMimeType(imageBlob.type || 'image/jpeg')}`,
          originalUrl: imageUrls[i],
          originalIndex: i, // 添加原始索引
          processOrder: i + 1 // 添加处理顺序
        };
        
        imageBlobs.push(imageData);
        
        console.log(`✅ 第${i + 1}张图片提取成功，大小: ${(imageBlob.size / 1024).toFixed(2)}KB，类型: ${imageBlob.type}`);
        console.log(`📋 当前已提取图片数量: ${imageBlobs.length}/${imageUrls.length}`);
        
      } else {
        console.error(`❌ 第${i + 1}张图片加载失败`);
        console.log(`⚠️ 第${i + 1}张图片加载失败，跳过此图片但继续处理下一张`);
        // 【修复】失败的图片不添加到数组中，但继续处理下一张，保持成功图片的相对顺序
      }
      
    } catch (error) {
      console.error(`❌ 提取第${i + 1}张图片失败:`, error);
      console.log(`⚠️ 第${i + 1}张图片处理异常，跳过此图片但继续处理下一张`);
      // 【修复】异常的图片不添加到数组中，但继续处理下一张，保持成功图片的相对顺序
    }
  }
  
  // 【调试】打印最终的图片顺序
  console.log('\n📋 最终图片提取顺序验证:');
  imageBlobs.forEach((blob, index) => {
    console.log(`${index + 1}. ${blob.filename} - ✅ 成功 (原始位置: ${blob.originalIndex + 1})`);
  });
  
  console.log(`\n📊 图片提取完成统计: ${imageBlobs.length}/${imageUrls.length} 张图片成功提取`);
  
  // 【关键修复】直接返回成功的图片数组，由于我们是按顺序处理的，所以成功的图片仍然保持原有的相对顺序
  return imageBlobs;
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

// 通过img元素加载图片并转换为Blob（优化版本）
function loadImageAsBlob(imageUrl) {
  return new Promise((resolve, reject) => {
    console.log('开始加载图片:', imageUrl);
    
    // 策略1: 直接使用页面上已存在的图片元素
    const existingImg = Array.from(document.querySelectorAll('img')).find(img => 
      img.src && (img.src === imageUrl || img.src.includes(imageUrl.split('/').pop()))
    );
    
    if (existingImg && existingImg.complete && existingImg.naturalWidth > 0) {
      console.log('使用页面已存在的图片元素');
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = existingImg.naturalWidth;
        canvas.height = existingImg.naturalHeight;
        
        // 【调试】在绘制图片前，打印canvas信息
        console.log(`Canvas准备绘制 - 尺寸: ${canvas.width}x${canvas.height}`);
        console.log(`原图尺寸: ${existingImg.naturalWidth}x${existingImg.naturalHeight}`);
        
        ctx.drawImage(existingImg, 0, 0);
        
        // 【调试】绘制后，先获取canvas的base64进行检查
        const canvasDataUrl = canvas.toDataURL('image/jpeg', 0.9);
        const canvasBase64 = canvasDataUrl.split(',')[1];
        console.log('=== Canvas绘制完成后的base64 ===');
        console.log('Canvas Base64 (前100字符):', canvasBase64.substring(0, 100));
        console.log('Canvas Base64长度:', canvasBase64.length);
        
        canvas.toBlob((blob) => {
          if (blob) {
            console.log('从已存在图片转换blob成功:', (blob.size / 1024).toFixed(2), 'KB');
            resolve(blob);
          } else {
            console.log('从已存在图片转换blob失败，尝试其他方案');
            tryLoadNewImage();
          }
        }, 'image/jpeg', 0.9);
        
        return;
      } catch (error) {
        console.log('使用已存在图片失败，尝试其他方案:', error);
      }
    }
    
    // 策略2: 创建新的img元素加载
    function tryLoadNewImage() {
      console.log('尝试创建新的img元素加载');
      const img = new Image();
      
      // 关键：设置referrer策略
      img.referrerPolicy = 'no-referrer-when-downgrade';
      img.crossOrigin = 'anonymous';
      
      let isResolved = false;
      
      img.onload = function() {
        if (isResolved) return;
        isResolved = true;
        
        console.log('新img元素加载成功，尺寸:', this.naturalWidth, 'x', this.naturalHeight);
        
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          canvas.width = this.naturalWidth;
          canvas.height = this.naturalHeight;
          
          // 【调试】在绘制图片前，打印canvas信息
          console.log(`新img Canvas准备绘制 - 尺寸: ${canvas.width}x${canvas.height}`);
          
          ctx.drawImage(this, 0, 0);
          
          // 【调试】绘制后，先获取canvas的base64进行检查
          const canvasDataUrl = canvas.toDataURL('image/jpeg', 0.9);
          const canvasBase64 = canvasDataUrl.split(',')[1];
          console.log('=== 新img Canvas绘制完成后的base64 ===');
          console.log('新img Canvas Base64 (前100字符):', canvasBase64.substring(0, 100));
          console.log('新img Canvas Base64长度:', canvasBase64.length);
          
          canvas.toBlob((blob) => {
            if (blob) {
              console.log('新img转换blob成功:', (blob.size / 1024).toFixed(2), 'KB');
              resolve(blob);
            } else {
              console.log('新img转换blob失败，尝试其他方案');
              tryProxyImage();
            }
          }, 'image/jpeg', 0.9);
          
        } catch (error) {
          console.error('canvas处理新img失败:', error);
          tryProxyImage();
        }
      };
      
      img.onerror = function() {
        if (isResolved) return;
        isResolved = true;
        console.log('新img加载失败，尝试其他方案');
        tryProxyImage();
      };
      
      // 设置超时
      setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          console.log('新img加载超时，尝试其他方案');
          tryProxyImage();
        }
      }, 15000);
      
      // 开始加载
      img.src = imageUrl;
    }
    
    // 策略3: 尝试通过代理或修改URL的方式
    function tryProxyImage() {
      console.log('尝试URL变换方案');
      
      // 尝试不同的URL变换
      const urlVariants = [
        imageUrl,
        imageUrl.replace(/!.*$/, ''), // 移除所有参数
        imageUrl + '?imageMogr2/auto-orient/strip', // 添加处理参数
        imageUrl.replace('sns-webpic-qc', 'sns-webpic'), // 尝试不同的CDN节点
        imageUrl.replace('https://', 'http://'), // 尝试http
      ];
      
      let currentIndex = 0;
      
      function tryNextVariant() {
        if (currentIndex >= urlVariants.length) {
          console.log('所有URL变换都失败了');
          reject(new Error('所有图片加载策略都失败了'));
          return;
        }
        
        const variantUrl = urlVariants[currentIndex];
        currentIndex++;
        
        console.log('尝试URL变换:', variantUrl);
        
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.referrerPolicy = 'no-referrer';
        
        let resolved = false;
        
        img.onload = function() {
          if (resolved) return;
          resolved = true;
          
          console.log('URL变换成功:', variantUrl);
          
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            canvas.width = this.naturalWidth;
            canvas.height = this.naturalHeight;
            
            // 【调试】在绘制图片前，打印canvas信息
            console.log(`URL变换 Canvas准备绘制 - 尺寸: ${canvas.width}x${canvas.height}`);
            
            ctx.drawImage(this, 0, 0);
            
            // 【调试】绘制后，先获取canvas的base64进行检查
            const canvasDataUrl = canvas.toDataURL('image/jpeg', 0.9);
            const canvasBase64 = canvasDataUrl.split(',')[1];
            console.log('=== URL变换 Canvas绘制完成后的base64 ===');
            console.log('URL变换 Canvas Base64 (前100字符):', canvasBase64.substring(0, 100));
            console.log('URL变换 Canvas Base64长度:', canvasBase64.length);
            
            canvas.toBlob((blob) => {
              if (blob) {
                console.log('URL变换转blob成功:', (blob.size / 1024).toFixed(2), 'KB');
                resolve(blob);
              } else {
                tryNextVariant();
              }
            }, 'image/jpeg', 0.9);
            
          } catch (error) {
            console.error('URL变换canvas处理失败:', error);
            tryNextVariant();
          }
        };
        
        img.onerror = function() {
          if (resolved) return;
          resolved = true;
          console.log('URL变换失败:', variantUrl);
          tryNextVariant();
        };
        
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            console.log('URL变换超时:', variantUrl);
            tryNextVariant();
          }
        }, 10000);
        
        img.src = variantUrl;
      }
      
      tryNextVariant();
    }
    
    // 开始第一种策略
    tryLoadNewImage();
  });
}

// 根据MIME类型获取文件扩展名
function getFileExtensionFromMimeType(mimeType) {
  const mimeToExt = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/bmp': 'bmp',
    'image/svg+xml': 'svg'
  };
  
  return mimeToExt[mimeType] || 'jpg';
}

// 提取笔记数据（保持向后兼容）
function collectNoteData() {
  // 同步版本，用于向后兼容
  return collectNoteDataAsync();
}
