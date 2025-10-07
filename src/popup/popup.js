/**
 * popup.js 负责处理弹窗中的基础交互逻辑。
 * 当前阶段实现选项卡切换、当前页面清理功能及状态反馈，为后续功能扩展提供架构支持。
 */

import { StorageService } from "../common/storage.js";
import {
  STORAGE_KEYS,
  DEFAULT_GENERAL_SETTINGS,
  normalizeGeneralSettings,
  resolveSinceTimestamp,
  DATA_TYPE_OPTIONS,
} from "../common/settings.js";
import { hasChromeRuntime } from "../common/utils.js";

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

/**
 * 初始化“当前页面”面板，读取默认设置并绑定清理逻辑。
 */
async function initCurrentTabPanel() {
  const form = document.querySelector("[data-current-form]");
  if (!form) {
    return;
  }

  const statusElement = document.querySelector("[data-current-status]");
  const applyDefaultsButton = document.querySelector("[data-apply-defaults]");
  const rangeSelect = document.querySelector("[data-current-range]");
  const typeInputs = Array.from(document.querySelectorAll("[data-current-type]"));
  const titleElement = document.querySelector("[data-current-title]");
  const urlElement = document.querySelector("[data-current-url]");
  const faviconElement = document.querySelector("[data-current-favicon]");

  let statusTimer;
  let currentTab = null;
  let generalDefaults = normalizeGeneralSettings(DEFAULT_GENERAL_SETTINGS);
  const storage = new StorageService();
  await storage.ready;

  function showStatus(message, tone = "info") {
    if (!statusElement) {
      return;
    }

    window.clearTimeout(statusTimer);
    statusElement.textContent = message;
    statusElement.dataset.tone = tone;
    statusTimer = window.setTimeout(() => {
      statusElement.textContent = "";
      delete statusElement.dataset.tone;
    }, 3200);
  }

  function applySettings(settings) {
    if (rangeSelect) {
      rangeSelect.value = settings.timeRange;
    }

    typeInputs.forEach((input) => {
      input.checked = Boolean(settings.dataTypes[input.value]);
    });
  }

  function collectSelection() {
    const selected = typeInputs
      .filter((input) => input.checked)
      .map((input) => input.value);
    return selected;
  }

  function updateTabSummary(tab) {
    if (!titleElement || !urlElement || !faviconElement) {
      return;
    }

    if (!tab) {
      titleElement.textContent = "无法获取当前标签页";
      urlElement.textContent = "请确认扩展拥有标签页权限";
      faviconElement.src = "../assets/icons/icon32.png";
      faviconElement.alt = "Tab Clean Master";
      return;
    }

    titleElement.textContent = tab.title || "未命名标签页";
    urlElement.textContent = tab.url || "";
    faviconElement.src = tab.favIconUrl || "../assets/icons/icon32.png";
    faviconElement.alt = tab.title || "当前站点";
  }

  async function fetchCurrentTab() {
    if (!hasChromeRuntime() || !chrome.tabs || !chrome.tabs.query) {
      return null;
    }

    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      return tabs[0] || null;
    } catch (error) {
      console.error("[Tab Clean Master] 读取标签页信息失败", error);
      return null;
    }
  }

  function buildRemovalPayload(selectedTypes) {
    const originScoped = {};
    const globalScoped = {};

    selectedTypes.forEach((id) => {
      const option = DATA_TYPE_OPTIONS.find((item) => item.id === id);
      if (!option) {
        return;
      }

      if (option.supportsOrigins) {
        originScoped[option.key] = true;
      } else {
        globalScoped[option.key] = true;
      }
    });

    return { originScoped, globalScoped };
  }

  function executeRemoval(options, dataToRemove) {
    return new Promise((resolve, reject) => {
      try {
        chrome.browsingData.remove(options, dataToRemove, () => {
          const error = chrome.runtime?.lastError;
          if (error) {
            reject(new Error(error.message));
            return;
          }
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const selectedTypes = collectSelection();
    if (!selectedTypes.length) {
      showStatus("请至少选择一种需要清理的数据类型", "error");
      return;
    }

    if (!hasChromeRuntime() || !chrome.browsingData || !chrome.browsingData.remove) {
      showStatus("当前环境不支持浏览数据清理。", "error");
      return;
    }

    if (!currentTab || !currentTab.url) {
      showStatus("无法获取当前标签页地址。", "error");
      return;
    }

    const since = resolveSinceTimestamp(rangeSelect?.value || generalDefaults.timeRange);
    const { originScoped, globalScoped } = buildRemovalPayload(selectedTypes);

    let origin = null;
    try {
      origin = new URL(currentTab.url).origin;
    } catch (error) {
      console.warn("[Tab Clean Master] 无法解析当前页面 URL", error);
    }

    if (!origin && Object.keys(originScoped).length) {
      showStatus("无法解析当前站点，将针对全部数据进行清理。", "warning");
    }

    showStatus("正在清理中，请稍候…", "info");

    try {
      const tasks = [];
      if (Object.keys(originScoped).length) {
        const options = { since };
        if (origin) {
          options.origins = [origin];
        }
        tasks.push(executeRemoval(options, originScoped));
      }

      if (Object.keys(globalScoped).length) {
        const options = { since };
        tasks.push(executeRemoval(options, globalScoped));
      }

      await Promise.all(tasks);
      showStatus("清理完成！", "success");
    } catch (error) {
      console.error("[Tab Clean Master] 清理失败", error);
      showStatus("清理过程中出现问题，请稍后重试。", "error");
    }
  }

  if (applyDefaultsButton) {
    applyDefaultsButton.addEventListener("click", () => {
      applySettings(generalDefaults);
      showStatus("已应用默认设置", "info");
    });
  }

  form.addEventListener("submit", handleSubmit);

  const stored = await storage.get(STORAGE_KEYS.generalOptions);
  generalDefaults = normalizeGeneralSettings(stored[STORAGE_KEYS.generalOptions]);
  applySettings(generalDefaults);

  currentTab = await fetchCurrentTab();
  updateTabSummary(currentTab);
}

initCurrentTabPanel();
