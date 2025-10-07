/**
 * options.js 为通用设置页面提供基础的模块化结构。
 * 当前阶段预留事件注册与存储交互接口，便于后续阶段直接扩展。
 */

import { StorageService } from "../common/storage.js";
import {
  STORAGE_KEYS,
  DEFAULT_GENERAL_SETTINGS,
  normalizeGeneralSettings,
  AUTOMATION_THRESHOLD,
  BROWSER_EVENT_AUTOMATION,
} from "../common/settings.js";

const STATUS_DURATION = 3200;

const form = document.getElementById("options-form");
const statusElement = document.querySelector("[data-status]");
const resetButton = document.querySelector("[data-reset]");

let storage;
let statusTimer;
let currentSettings = normalizeGeneralSettings(DEFAULT_GENERAL_SETTINGS);

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
  }, STATUS_DURATION);
}

function readSettingsFromForm() {
  if (!form) {
    return currentSettings;
  }

  const formData = new FormData(form);
  const timeRange = formData.get("timeRange") || currentSettings.timeRange;

  const dataTypes = { ...currentSettings.dataTypes };
  const checkboxes = form.querySelectorAll("input[data-type]");
  checkboxes.forEach((checkbox) => {
    dataTypes[checkbox.value] = checkbox.checked;
  });

  const automationEnabledInput = form.querySelector(
    "input[data-automation=\"enabled\"]"
  );
  const automationThresholdInput = form.querySelector(
    "input[data-automation=\"threshold\"]"
  );

  const automation = {
    enabled: automationEnabledInput ? automationEnabledInput.checked : false,
    threshold: automationThresholdInput
      ? Number.parseInt(automationThresholdInput.value, 10)
      : currentSettings.automation.threshold,
    browserEvent: currentSettings.automation.browserEvent,
  };

  const browserEventInput = formData.get("browserEvent");
  if (typeof browserEventInput === "string") {
    automation.browserEvent = browserEventInput;
  }

  return normalizeGeneralSettings({ timeRange, dataTypes, automation });
}

function applySettingsToForm(settings) {
  if (!form) {
    return;
  }

  const timeInputs = form.querySelectorAll('input[name="timeRange"]');
  timeInputs.forEach((input) => {
    input.checked = input.value === settings.timeRange;
  });

  const dataInputs = form.querySelectorAll("input[data-type]");
  dataInputs.forEach((input) => {
    input.checked = Boolean(settings.dataTypes[input.value]);
  });

  const automationEnabledInput = form.querySelector(
    "input[data-automation=\"enabled\"]"
  );
  if (automationEnabledInput) {
    automationEnabledInput.checked = Boolean(settings.automation.enabled);
  }

  const automationThresholdInput = form.querySelector(
    "input[data-automation=\"threshold\"]"
  );
  if (automationThresholdInput) {
    automationThresholdInput.value = String(settings.automation.threshold);
  }

  const browserEventInputs = form.querySelectorAll('input[name="browserEvent"]');
  browserEventInputs.forEach((input) => {
    input.checked =
      input.value ===
      (settings.automation.browserEvent || BROWSER_EVENT_AUTOMATION[0]);
  });
}

async function persistSettings(settings) {
  try {
    await storage.set({ [STORAGE_KEYS.generalOptions]: settings });
    currentSettings = settings;
    showStatus("设置已保存");
    window.dispatchEvent(
      new CustomEvent("tab-clean-master:general-options-updated", {
        detail: settings,
      })
    );
  } catch (error) {
    console.error("[Tab Clean Master] 保存设置失败", error);
    showStatus("保存设置时出现问题，请稍后重试", "error");
  }
}

function handleFormChange() {
  if (!form) {
    return;
  }

  const newSettings = readSettingsFromForm();
  applySettingsToForm(newSettings);
  persistSettings(newSettings);
}

function handleThresholdInput(eventOrElement) {
  const input =
    eventOrElement instanceof HTMLInputElement
      ? eventOrElement
      : eventOrElement?.target;
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

function restoreDefaults() {
  const defaults = normalizeGeneralSettings(DEFAULT_GENERAL_SETTINGS);
  applySettingsToForm(defaults);
  persistSettings(defaults);
  showStatus("已恢复默认设置");
}

/**
 * 负责初始化选项页面，未来将加载用户配置并绑定事件。
 */
async function initOptionsPage() {
  try {
    if (!form) {
      console.warn("[Tab Clean Master] 未找到选项表单节点。");
      return;
    }

    storage = new StorageService();
    await storage.ready;

    const stored = await storage.get(STORAGE_KEYS.generalOptions);
    currentSettings = normalizeGeneralSettings(
      stored[STORAGE_KEYS.generalOptions]
    );
    applySettingsToForm(currentSettings);

    form.addEventListener("change", handleFormChange);
    const thresholdInput = form.querySelector(
      "input[data-automation=\"threshold\"]"
    );
    if (thresholdInput) {
      thresholdInput.addEventListener("input", handleThresholdInput);
      handleThresholdInput(thresholdInput);
    }

    if (resetButton) {
      resetButton.addEventListener("click", restoreDefaults);
    }

    console.info("[Tab Clean Master] 通用选项页面初始化完成。");
  } catch (error) {
    console.error("[Tab Clean Master] 初始化失败", error);
    showStatus("初始化失败，请刷新页面重试", "error");
  }
}

initOptionsPage();
