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
      const data = collectNoteData();
      sendResponse({
        isNotePage: true,
        data: data
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
});

// 提取笔记数据
function collectNoteData() {
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
  
  // 添加调试信息
  console.log('提取的笔记数据:', {
    url,
    author: username,
    title,
    content,
    tags,
    likes,
    collects,
    comments
  });
  
  return {
    url,
    author: username,
    title,
    content,
    tags,
    likes,
    collects,
    comments
  };
}
