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
  derivePanelSelectionFromGeneral,
  normalizePanelSelection,
  AUTOMATION_THRESHOLD,
  BROWSER_EVENT_AUTOMATION,
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
function observeGeneralSettings(callback) {
  window.addEventListener("tab-clean-master:general-options-updated", (event) => {
    callback(normalizeGeneralSettings(event.detail ?? {}));
  });

  if (
    hasChromeRuntime() &&
    chrome.storage &&
    typeof chrome.storage.onChanged?.addListener === "function"
  ) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (
        areaName === "sync" &&
        changes[STORAGE_KEYS.generalOptions] &&
        changes[STORAGE_KEYS.generalOptions].newValue
      ) {
        callback(normalizeGeneralSettings(changes[STORAGE_KEYS.generalOptions].newValue));
      }
    });
  }
}
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
  const rangeSelect = form.querySelector("[data-current-range]");
  const typeInputs = Array.from(form.querySelectorAll("[data-current-type]"));
  const reloadToggle = form.querySelector("[data-current-reload]");
  const titleElement = document.querySelector("[data-current-title]");
  const urlElement = document.querySelector("[data-current-url]");
  const faviconElement = document.querySelector("[data-current-favicon]");

  let statusTimer;
  let currentTab = null;
  let generalSettings = normalizeGeneralSettings(DEFAULT_GENERAL_SETTINGS);
  let generalDefaults = derivePanelSelectionFromGeneral(generalSettings);
  generalDefaults = normalizePanelSelection(generalDefaults);
  let panelSelection = normalizePanelSelection(undefined, generalDefaults);
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

    if (reloadToggle) {
      reloadToggle.checked = Boolean(settings.reloadAfterCleanup);
    }
  }
  function readSelection() {
    const nextSelection = {
      timeRange: rangeSelect?.value || panelSelection.timeRange,
      dataTypes: { ...panelSelection.dataTypes },
      reloadAfterCleanup:
        reloadToggle instanceof HTMLInputElement
          ? reloadToggle.checked
          : panelSelection.reloadAfterCleanup,
    };

    typeInputs.forEach((input) => {
      nextSelection.dataTypes[input.value] = input.checked;
    });

    return normalizePanelSelection(nextSelection, generalDefaults);
  }

  async function persistSelection(selection) {
    try {
      await storage.set({
        [STORAGE_KEYS.currentTabPreferences]: selection,
      });
      panelSelection = selection;
    } catch (error) {
      console.error("[Tab Clean Master] 保存当前页面偏好失败", error);
    }
  }

  function updateTabSummary(tab) {
    if (!titleElement || !urlElement || !faviconElement) {
      return;
    }

    if (!tab) {
      titleElement.textContent = "无法获取当前标签页";
      urlElement.textContent = "请确认扩展拥有标签页权限";
      faviconElement.src = "../assets/icons/Chrome.png";
      faviconElement.alt = "Tab Clean Master";
      return;
    }

    titleElement.textContent = tab.title || "未命名标签页";
    urlElement.textContent = tab.url || "";
    faviconElement.src = tab.favIconUrl || "../assets/icons/Chrome.png";
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
    const selection = readSelection();
    const selectedTypes = Object.entries(selection.dataTypes)
      .filter(([, enabled]) => enabled)
      .map(([id]) => id);
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
    const since = resolveSinceTimestamp(selection.timeRange);
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
      await persistSelection(selection);

      const shouldReload =
        selection.reloadAfterCleanup &&
        hasChromeRuntime() &&
        chrome.tabs?.reload &&
        typeof currentTab?.id !== "undefined";

      showStatus(
        shouldReload ? "清理完成，正在刷新页面…" : "清理完成！",
        "success"
      );

      if (shouldReload) {
        try {
          chrome.tabs.reload(currentTab.id, () => {
            const error = chrome.runtime?.lastError;
            if (error) {
              console.error("[Tab Clean Master] 页面刷新失败", error);
              showStatus("页面刷新失败，请手动刷新。", "warning");
            }
          });
        } catch (error) {
          console.error("[Tab Clean Master] 页面刷新异常", error);
          showStatus("页面刷新失败，请手动刷新。", "warning");
        }
      }
    } catch (error) {
      console.error("[Tab Clean Master] 清理失败", error);
      showStatus("清理过程中出现问题，请稍后重试。", "error");
    }
  }
  function handleFormChange() {
    const selection = readSelection();
    applySettings(selection);
    persistSelection(selection);
  }

  if (applyDefaultsButton) {
    applyDefaultsButton.addEventListener("click", () => {
      const defaults = normalizePanelSelection(generalDefaults, generalDefaults);
      applySettings(defaults);
      persistSelection(defaults);
      showStatus("已应用默认设置", "info");
    });
  }

  form.addEventListener("submit", handleSubmit);
  form.addEventListener("change", handleFormChange);

  const [storedGeneral, storedPanel] = await Promise.all([
    storage.get(STORAGE_KEYS.generalOptions),
    storage.get(STORAGE_KEYS.currentTabPreferences),
  ]);

  if (storedGeneral[STORAGE_KEYS.generalOptions]) {
    generalSettings = normalizeGeneralSettings(
      storedGeneral[STORAGE_KEYS.generalOptions]
    );
    generalDefaults = normalizePanelSelection(
      derivePanelSelectionFromGeneral(generalSettings)
    );
  }

  panelSelection = normalizePanelSelection(
    storedPanel[STORAGE_KEYS.currentTabPreferences],
    generalDefaults
  );

  applySettings(panelSelection);

  currentTab = await fetchCurrentTab();
  updateTabSummary(currentTab);

  observeGeneralSettings((nextGeneral) => {
    generalSettings = nextGeneral;
    generalDefaults = normalizePanelSelection(
      derivePanelSelectionFromGeneral(generalSettings)
    );
    panelSelection = normalizePanelSelection(panelSelection, generalDefaults);
    applySettings(panelSelection);
  });
}

initCurrentTabPanel();

async function initGlobalPanel() {
  const form = document.querySelector("[data-global-form]");
  if (!form) {
    return;
  }

  const statusElement = form.querySelector("[data-global-status]");
  const applyDefaultsButton = form.querySelector("[data-global-apply-defaults]");
  const selectAllButton = form.querySelector("[data-global-select-all]");
  const selectNoneButton = form.querySelector("[data-global-select-none]");
  const rangeSelect = form.querySelector("[data-global-range]");
  const typeInputs = Array.from(form.querySelectorAll("[data-global-type]"));

  let statusTimer;
  let generalSettings = normalizeGeneralSettings(DEFAULT_GENERAL_SETTINGS);
  let generalDefaults = derivePanelSelectionFromGeneral(generalSettings);
  let panelSelection = normalizePanelSelection(undefined, generalDefaults);
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

  function readSelection() {
    const nextSelection = {
      timeRange: rangeSelect?.value || panelSelection.timeRange,
      dataTypes: { ...panelSelection.dataTypes },
    };

    typeInputs.forEach((input) => {
      nextSelection.dataTypes[input.value] = input.checked;
    });

    return normalizePanelSelection(nextSelection, generalDefaults);
  }

  async function persistSelection(selection) {
    try {
      await storage.set({
        [STORAGE_KEYS.globalCleanupPreferences]: selection,
      });
      panelSelection = selection;
    } catch (error) {
      console.error("[Tab Clean Master] 保存全局清理偏好失败", error);
    }
  }

  function buildRemovalData(selection) {
    const data = {};
    Object.entries(selection.dataTypes).forEach(([id, enabled]) => {
      if (!enabled) {
        return;
      }
      const option = DATA_TYPE_OPTIONS.find((item) => item.id === id);
      if (!option) {
        return;
      }
      data[option.key] = true;
    });
    return data;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const selection = readSelection();
    const removalData = buildRemovalData(selection);
    if (!Object.keys(removalData).length) {
      showStatus("请至少选择一种需要清理的数据类型", "error");
      return;
    }

    if (!hasChromeRuntime() || !chrome.browsingData?.remove) {
      showStatus("当前环境不支持浏览数据清理。", "error");
      return;
    }

    const since = resolveSinceTimestamp(selection.timeRange);
    showStatus("正在清理中，请稍候…", "info");

    try {
      await new Promise((resolve, reject) => {
        try {
          chrome.browsingData.remove({ since }, removalData, () => {
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

      showStatus("全局清理完成！", "success");
      await persistSelection(selection);
    } catch (error) {
      console.error("[Tab Clean Master] 全局清理失败", error);
      showStatus("清理过程中出现问题，请稍后重试。", "error");
    }
  }

  function handleFormChange() {
    const selection = readSelection();
    applySettings(selection);
    persistSelection(selection);
  }

  if (applyDefaultsButton) {
    applyDefaultsButton.addEventListener("click", () => {
      const defaults = normalizePanelSelection(generalDefaults, generalDefaults);
      applySettings(defaults);
      persistSelection(defaults);
      showStatus("已应用默认设置", "info");
    });
  }

  if (selectAllButton) {
    selectAllButton.addEventListener("click", () => {
      typeInputs.forEach((input) => {
        input.checked = true;
      });
      handleFormChange();
    });
  }

  if (selectNoneButton) {
    selectNoneButton.addEventListener("click", () => {
      typeInputs.forEach((input) => {
        input.checked = false;
      });
      handleFormChange();
    });
  }

  form.addEventListener("submit", handleSubmit);
  form.addEventListener("change", handleFormChange);

  const [storedGeneral, storedPanel] = await Promise.all([
    storage.get(STORAGE_KEYS.generalOptions),
    storage.get(STORAGE_KEYS.globalCleanupPreferences),
  ]);

  if (storedGeneral[STORAGE_KEYS.generalOptions]) {
    generalSettings = normalizeGeneralSettings(
      storedGeneral[STORAGE_KEYS.generalOptions]
    );
    generalDefaults = derivePanelSelectionFromGeneral(generalSettings);
  }

  panelSelection = normalizePanelSelection(
    storedPanel[STORAGE_KEYS.globalCleanupPreferences],
    generalDefaults
  );

  applySettings(panelSelection);

  observeGeneralSettings((nextGeneral) => {
    generalSettings = nextGeneral;
    generalDefaults = derivePanelSelectionFromGeneral(generalSettings);
    panelSelection = normalizePanelSelection(panelSelection, generalDefaults);
    applySettings(panelSelection);
  });
}

initGlobalPanel();

async function initPopupSettingsPanel() {
  const form = document.querySelector("[data-settings-form]");
  if (!form) {
    return;
  }

  const statusElement = form.querySelector("[data-settings-status]");
  const resetButton = form.querySelector("[data-settings-reset]");
  const openOptionsButton = form.querySelector("[data-open-options]");
  const thresholdInput = form.querySelector(
    "[data-settings-automation=\"threshold\"]"
  );
  const automationToggle = form.querySelector(
    "[data-settings-automation=\"enabled\"]"
  );
  const timeInputs = Array.from(form.querySelectorAll('input[name="timeRange"]'));
  const typeInputs = Array.from(
    form.querySelectorAll("input[data-settings-type]")
  );

  let statusTimer;
  let currentSettings = normalizeGeneralSettings(DEFAULT_GENERAL_SETTINGS);
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
    timeInputs.forEach((input) => {
      input.checked = input.value === settings.timeRange;
    });

    typeInputs.forEach((input) => {
      input.checked = Boolean(settings.dataTypes[input.value]);
    });

    if (automationToggle) {
      automationToggle.checked = Boolean(settings.automation.enabled);
    }

    if (thresholdInput) {
      thresholdInput.value = String(settings.automation.threshold);
    }
  }

  function readSettings() {
    const selectedTime =
      timeInputs.find((input) => input.checked)?.value || currentSettings.timeRange;

    const dataTypes = { ...currentSettings.dataTypes };
    typeInputs.forEach((input) => {
      dataTypes[input.value] = input.checked;
    });

    const automation = {
      enabled: automationToggle ? automationToggle.checked : false,
      threshold: thresholdInput
        ? Number.parseInt(thresholdInput.value, 10)
        : currentSettings.automation.threshold,
      browserEvent:
        currentSettings.automation.browserEvent ??
        BROWSER_EVENT_AUTOMATION[0],
    };

    return normalizeGeneralSettings({
      timeRange: selectedTime,
      dataTypes,
      automation,
    });
  }

  async function persistSettings(settings) {
    try {
      await storage.set({ [STORAGE_KEYS.generalOptions]: settings });
      currentSettings = settings;
      showStatus("设置已保存", "success");
      window.dispatchEvent(
        new CustomEvent("tab-clean-master:general-options-updated", {
          detail: settings,
        })
      );
    } catch (error) {
      console.error("[Tab Clean Master] 保存通用选项失败", error);
      showStatus("保存设置时出现问题，请稍后重试", "error");
    }
  }

  function clampThreshold(input) {
    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    const value = Number.parseInt(input.value, 10);
    if (!Number.isFinite(value)) {
      return;
    }

    const clamped = Math.min(
      AUTOMATION_THRESHOLD.max,
      Math.max(AUTOMATION_THRESHOLD.min, value)
    );

    if (clamped !== value) {
      input.value = String(clamped);
    }
  }

  function handleFormChange() {
    if (thresholdInput) {
      clampThreshold(thresholdInput);
    }
    const settings = readSettings();
    applySettings(settings);
    persistSettings(settings);
  }

  if (thresholdInput) {
    thresholdInput.addEventListener("input", () => clampThreshold(thresholdInput));
  }

  if (resetButton) {
    resetButton.addEventListener("click", () => {
      const defaults = normalizeGeneralSettings(DEFAULT_GENERAL_SETTINGS);
      applySettings(defaults);
      persistSettings(defaults);
    });
  }

  if (openOptionsButton) {
    openOptionsButton.addEventListener("click", () => {
      if (hasChromeRuntime() && chrome.runtime?.openOptionsPage) {
        chrome.runtime.openOptionsPage();
        return;
      }

      const fallbackUrl =
        hasChromeRuntime() && chrome.runtime?.getURL
          ? chrome.runtime.getURL("options/options.html")
          : "../options/options.html";
      window.open(fallbackUrl, "_blank", "noopener");
    });
  }

  form.addEventListener("change", handleFormChange);

  const stored = await storage.get(STORAGE_KEYS.generalOptions);
  if (stored[STORAGE_KEYS.generalOptions]) {
    currentSettings = normalizeGeneralSettings(
      stored[STORAGE_KEYS.generalOptions]
    );
  }

  applySettings(currentSettings);

  observeGeneralSettings((nextGeneral) => {
    currentSettings = nextGeneral;
    applySettings(currentSettings);
  });
}

initPopupSettingsPanel();
