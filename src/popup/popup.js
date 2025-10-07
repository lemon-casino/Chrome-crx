/**
 * popup.js 负责处理弹窗中的基础交互逻辑。
 * 当前阶段实现选项卡切换与基础状态同步，为后续功能扩展提供架构支持。
 */

/**
 * @typedef {Object} TabElements
 * @property {HTMLButtonElement} button - 与面板关联的选项卡按钮。
 * @property {HTMLElement} panel - 需要展示的内容面板。
 */

const TAB_SELECTOR = '[role="tab"]';
const PANEL_SELECTOR = '[role="tabpanel"]';

/**
 * 根据传入的目标 ID 激活对应的选项卡和内容面板。
 * @param {Map<string, TabElements>} tabsMap - 维护按钮和面板映射的容器。
 * @param {string} targetId - 需要显示的面板 ID。
 */
function activateTab(tabsMap, targetId) {
  tabsMap.forEach(({ button, panel }, id) => {
    const isActive = id === targetId;
    button.classList.toggle('tabs__tab--active', isActive);
    button.setAttribute('aria-selected', String(isActive));
    panel.classList.toggle('panel--active', isActive);
    panel.hidden = !isActive;
  });
}

/**
 * 初始化选项卡切换交互，包括点击和键盘箭头导航。
 */
function setupTabs() {
  const buttons = Array.from(document.querySelectorAll(TAB_SELECTOR));
  const panels = Array.from(document.querySelectorAll(PANEL_SELECTOR));

  if (!buttons.length || buttons.length !== panels.length) {
    console.warn('[Tab Clean Master] 选项卡结构未正确初始化。');
    return;
  }

  /** @type {Map<string, TabElements>} */
  const tabsMap = new Map();
  buttons.forEach((button) => {
    const targetId = button.dataset.target;
    const panel = document.getElementById(targetId);
    if (!targetId || !panel) {
      console.warn('[Tab Clean Master] 未找到选项卡关联的面板：', targetId);
      return;
    }
    tabsMap.set(targetId, { button, panel });
  });

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const targetId = button.dataset.target;
      if (targetId) {
        activateTab(tabsMap, targetId);
      }
    });

    button.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
        return;
      }

      event.preventDefault();
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      const currentIndex = buttons.indexOf(button);
      const nextIndex = (currentIndex + direction + buttons.length) % buttons.length;
      buttons[nextIndex].focus();
      const targetId = buttons[nextIndex].dataset.target;
      if (targetId) {
        activateTab(tabsMap, targetId);
      }
    });
  });
}

// 在模块加载后立即初始化交互逻辑，确保弹窗展示时可用。
setupTabs();
