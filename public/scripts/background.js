// 监听来自popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "exportExcel") {
    try {
      // 创建CSV数据
      const headers = [
        "标题",
        "详情",
        "商品价格",
        "想要数",
        "浏览量",
        "店铺名称",
        "地区",
        "商品链接",
        "是否为推荐商品",
      ];

      const rows = request.data.map((item) => [
        item.title || "",
        item.detail || "",
        item.price || "",
        item.wantCount || "",
        item.viewCount || "",
        item.shopName || "",
        item.area || "",
        item.link || "",
        item.isRecommended ? "是" : "否",
      ]);

      // 添加表头
      rows.unshift(headers);

      // 创建CSV内容
      const csvContent = rows
        .map((row) =>
          row
            .map((cell) => `"${(cell || "").toString().replace(/"/g, '""')}"`)
            .join(",")
        )
        .join("\n");

      // 添加 BOM 以支持中文
      const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
      const csvData = new Blob([bom, csvContent], {
        type: "text/csv;charset=utf-8;",
      });

      // 将 Blob 转换为 base64
      const reader = new FileReader();
      reader.onload = function () {
        const base64data = reader.result;
        const timestamp = new Date()
          .toLocaleString("zh-CN")
          .replace(/[\/\s:]/g, "_");
        const filename = `${request.fileName}_${timestamp}.csv`;

        // 使用 data URL 触发下载
        chrome.downloads.download(
          {
            url: base64data,
            filename: filename,
            saveAs: true,
          },
          (downloadId) => {
            if (chrome.runtime.lastError) {
              console.error("下载失败:", chrome.runtime.lastError);
              sendResponse({ error: chrome.runtime.lastError.message });
            } else {
              console.log("下载成功, downloadId:", downloadId);
              sendResponse({ success: true });
            }
          }
        );
      };

      reader.onerror = function () {
        console.error("文件读取失败:", reader.error);
        sendResponse({ error: "文件读取失败" });
      };

      // 读取 Blob 为 Data URL
      reader.readAsDataURL(csvData);
      return true; // 保持消息通道开放
    } catch (error) {
      console.error("导出失败:", error);
      sendResponse({ error: error.message });
    }
  }
  chrome.runtime.openOptionsPage();
});
