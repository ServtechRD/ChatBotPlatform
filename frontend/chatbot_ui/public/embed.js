(function () {
  // 默認配置
  const DEFAULT_WIDTH = 400;
  const DEFAULT_HEIGHT = 600;
  const DEFAULT_POSITION = 'inline';

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
    // 獲取容器元素
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`找不到ID為${containerId}的容器元素`);
      return;
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
        // 創建最小化按鈕
        const toggleButton = document.createElement('button');
        toggleButton.innerHTML = '&#x2715;'; // X符號
        toggleButton.style.position = 'fixed';
        toggleButton.style.bottom =
          (typeof config.height === 'number' ? config.height + 30 : '630') +
          'px';
        toggleButton.style.right = '20px';
        toggleButton.style.zIndex = '9999';
        toggleButton.style.width = '40px';
        toggleButton.style.height = '40px';
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

        // 最小化狀態
        let isMinimized = false;

        // 點擊事件
        toggleButton.addEventListener('click', function () {
          if (isMinimized) {
            iframe.style.display = 'block';
            toggleButton.innerHTML = '&#x2715;';
            toggleButton.style.bottom =
              (typeof config.height === 'number' ? config.height + 30 : '630') +
              'px';
            isMinimized = false;
          } else {
            iframe.style.display = 'none';
            toggleButton.innerHTML = '&#x1F4AC;'; // 對話泡泡符號
            toggleButton.style.bottom = '20px';
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
            }
            return originalRemoveChild.call(this, child);
          };
        }
      }
    }

    // 添加到容器
    container.appendChild(iframe);

    // 返回iframe引用，以便後續操作
    return iframe;
  }

  // 公開API
  window.AssistantChat = {
    init: initChat,
  };
})();
