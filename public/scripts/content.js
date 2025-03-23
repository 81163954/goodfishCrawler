console.log("content script loaded");

// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case "quickScrape":
      quickScrape().then(sendResponse);
      return true;
    case "detailScrape":
      detailScrape().then(sendResponse);
      return true;
    case "fullScrape":
      fullScrape().then(sendResponse);
      return true;
  }
});

// 快速抓取函数
async function quickScrape() {
  // 实现快速抓取逻辑
}

// 详情抓取函数
async function detailScrape() {
  // 实现详情抓取逻辑
}

// 完整抓取函数
async function fullScrape() {
  // 实现完整抓取逻辑
}
