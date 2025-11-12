(function () {
  // 默認配置
  const DEFAULT_WIDTH = 400;
  const DEFAULT_HEIGHT = 600;
  const DEFAULT_POSITION = 'inline';

  // 追蹤初始化狀態
  const initializedContainers = new Set();

  // 主域名，應該是React應用部署的位置
  const getDefaultHost = () => {
    // 可以硬編碼為實際的生產環境域名
    return 'cloud.servtech.com.tw';
  };

  /**
   * 初始化聊天窗口
   * @param {string} assistantId - 助手ID
   * @param {string} containerId - 容器元素ID
   * @param {Object} options - 配置選項
   */
  function initChat(assistantId, containerId, options = {}) {
    if (initializedContainers.has(containerId)) {
      console.log(`聊天助手已在容器 ${containerId} 中初始化，跳過重複初始化`);
      return;
    }

    // 獲取容器元素
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`找不到ID為${containerId}的容器元素`);
      return;
    }

    // 清空容器中可能存在的舊內容
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    // 合併選項
    const config = {
      width: options.width || DEFAULT_WIDTH,
      height: options.height || DEFAULT_HEIGHT,
      position: options.position || DEFAULT_POSITION,
      host: options.host || getDefaultHost(),
      protocol: options.protocol || window.location.protocol,
      minimizable: Boolean(options.minimizable),
      theme: options.theme || 'light',
      ...options,
    };

    // 創建iframe
    const iframe = document.createElement('iframe');

    // 設置iframe的src，指向React應用的嵌入頁面
    iframe.src = `${config.protocol}//${config.host}:36000/embed?id=${assistantId}`;

    // 設置iframe的樣式
    iframe.style.width =
      typeof config.width === 'number' ? `${config.width}px` : config.width;
    iframe.style.height =
      typeof config.height === 'number' ? `${config.height}px` : config.height;
    iframe.style.border = 'none';
    iframe.style.borderRadius = '8px';
    iframe.style.overflow = 'hidden';
    iframe.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';

    // 如果是固定定位
    if (config.position === 'fixed-bottom-right') {
      iframe.style.position = 'fixed';
      iframe.style.bottom = '20px';
      iframe.style.right = '20px';
      iframe.style.zIndex = '9999';

      // 如果需要最小化功能
      if (config.minimizable) {
        // 檢查是否已有按鈕
        const existingButton = document.getElementById(
          `toggle-button-${containerId}`
        );
        if (existingButton) {
          document.body.removeChild(existingButton);
        }

        // 創建最小化按鈕
        const toggleButton = document.createElement('button');
        toggleButton.id = `toggle-button-${containerId}`;

        // 默認使用文本，但我們會嘗試加載助手圖片
        toggleButton.innerHTML = '&#x1F4AC;'; // 對話泡泡符號

        // 嘗試加載助手圖片
        const imgElement = document.createElement('img');
        imgElement.style.width = '100%';
        imgElement.style.height = '100%';
        imgElement.style.borderRadius = '50%';
        imgElement.style.objectFit = 'cover';
        imgElement.alt = 'Chat';
        imgElement.onerror = () => {
          // 圖片加載失敗時顯示默認符號
          toggleButton.innerHTML = '&#x1F4AC;';
        };

        // 設置圖片源
        imgElement.src = `${config.protocol}//${config.host}:36100/api/embed/assistant/${assistantId}/image`;

        // 先清空按鈕內容，然後添加圖片
        toggleButton.innerHTML = '';
        toggleButton.appendChild(imgElement);

        // 設置按鈕樣式
        toggleButton.style.position = 'fixed';
        toggleButton.style.bottom = '20px'; // 初始位置在底部
        toggleButton.style.right = '20px';
        toggleButton.style.zIndex = '9999';
        toggleButton.style.width = '100px'; // 稍微大一點以顯示圖片
        toggleButton.style.height = '100px';
        toggleButton.style.borderRadius = '50%';
        toggleButton.style.backgroundColor = '#1976d2';
        toggleButton.style.color = 'white';
        toggleButton.style.border = 'none';
        toggleButton.style.cursor = 'pointer';
        toggleButton.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)';
        toggleButton.style.display = 'flex';
        toggleButton.style.alignItems = 'center';
        toggleButton.style.justifyContent = 'center';
        toggleButton.style.fontSize = '16px';
        toggleButton.style.padding = '0'; // 移除內邊距，以便圖片能充滿按鈕

        // 創建X按鈕的文本內容
        const closeText = document.createElement('span');
        closeText.innerHTML = '&#x2715;'; // X符號
        closeText.style.display = 'none'; // 初始隱藏

        // 最小化狀態
        let isMinimized = true; // 預設是最小化的
        iframe.style.display = 'none'; // 初始隱藏iframe

        // 先加載默認圖片符號
        toggleButton.innerHTML = '';
        toggleButton.appendChild(imgElement);
        toggleButton.appendChild(closeText);

        // 點擊事件
        toggleButton.addEventListener('click', function () {
          if (isMinimized) {
            // 展開聊天 - 顯示X符號
            iframe.style.display = 'block';
            toggleButton.style.bottom =
              (typeof config.height === 'number' ? config.height + 30 : '630') +
              'px';

            // 切換到X符號
            imgElement.style.display = 'none';
            closeText.style.display = 'block';

            // 調整按鈕尺寸為更小的X按鈕
            toggleButton.style.width = '40px';
            toggleButton.style.height = '40px';
            toggleButton.style.backgroundColor = '#555'; // 更改背景顏色

            isMinimized = false;
          } else {
            // 最小化聊天 - 顯示圖片
            iframe.style.display = 'none';
            toggleButton.style.bottom = '20px';

            // 切換到圖片
            closeText.style.display = 'none';
            imgElement.style.display = 'block';

            // 恢復按鈕尺寸
            toggleButton.style.width = '100px';
            toggleButton.style.height = '100px';
            toggleButton.style.backgroundColor = '#1976d2'; // 恢復原始背景顏色

            isMinimized = true;
          }
        });

        // 添加按鈕到頁面
        document.body.appendChild(toggleButton);

        // 在iframe卸載時也移除按鈕
        const removeButton = () => {
          if (document.body.contains(toggleButton)) {
            document.body.removeChild(toggleButton);
          }
        };

        // 添加卸載事件
        if (container) {
          const originalRemoveChild = container.removeChild;
          container.removeChild = function (child) {
            if (child === iframe) {
              removeButton();
              initializedContainers.delete(containerId); // 移除初始化標記
            }
            return originalRemoveChild.call(this, child);
          };
        }
      }
    }

    // 添加到容器
    container.appendChild(iframe);

    // 標記此容器為已初始化
    initializedContainers.add(containerId);

    // 返回iframe引用，以便後續操作
    return iframe;
  }

  // 提供銷毀方法
  function destroyChat(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // 清空容器
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    // 移除按鈕
    const toggleButton = document.getElementById(
      `toggle-button-${containerId}`
    );
    if (toggleButton && document.body.contains(toggleButton)) {
      document.body.removeChild(toggleButton);
    }

    // 移除初始化標記
    initializedContainers.delete(containerId);
  }

  // 公開API
  window.AssistantChat = {
    init: initChat,
    destroy: destroyChat,
    // 添加檢查方法
    isInitialized: containerId => initializedContainers.has(containerId),
  };
})();
