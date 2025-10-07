import { StorageService } from "../common/storage.js";
import {
  DATA_TYPE_OPTIONS,
  DEFAULT_GENERAL_SETTINGS,
  STORAGE_KEYS,
  normalizeGeneralSettings,
  resolveSinceTimestamp,
} from "../common/settings.js";

const ACTION_ICON_PATHS = {
  16: "assets/icons/Chrome.png",
  32: "assets/icons/Chrome.png",
  48: "assets/icons/Chrome.png",
};

async function applyActionIcons() {
  try {
    await chrome.action.setIcon({ path: ACTION_ICON_PATHS });
  } catch (error) {
    console.error("Failed to apply action icons", error);
  }
}

const storage = new StorageService();

function mapDataTypesToRemoval(settings) {
  return Object.entries(settings.dataTypes)
    .filter(([, enabled]) => enabled)
    .reduce((acc, [id]) => {
      const option = DATA_TYPE_OPTIONS.find((item) => item.id === id);
      if (option) {
        acc[option.key] = true;
      }
      return acc;
    }, {});
}

async function runAutomatedCleanup(trigger) {
  try {
    await storage.ready;
    const stored = await storage.get(STORAGE_KEYS.generalOptions);
    const generalSettings = normalizeGeneralSettings(
      stored[STORAGE_KEYS.generalOptions] ?? DEFAULT_GENERAL_SETTINGS
    );

    const preference = generalSettings.automation.browserEvent;
    if (trigger !== "startup" || preference !== "startup") {
      return;
    }

    const removalData = mapDataTypesToRemoval(generalSettings);
    if (!Object.keys(removalData).length) {
      return;
    }

    const since = resolveSinceTimestamp(generalSettings.timeRange);

    if (!chrome?.browsingData?.remove) {
      console.warn("[Tab Clean Master] 当前环境不支持浏览数据清理 API。");
      return;
    }

    await new Promise((resolve, reject) => {
      chrome.browsingData.remove({ since }, removalData, () => {
        const error = chrome.runtime?.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve();
      });
    });

    console.info("[Tab Clean Master] 已在浏览器启动时执行默认清理。");
  } catch (error) {
    console.error(
      `[Tab Clean Master] 自动清理执行失败（${trigger}）`,
      error
    );
  }
}

chrome.runtime.onInstalled.addListener(() => {
  applyActionIcons();
});

chrome.runtime.onStartup.addListener(() => {
  applyActionIcons();
  runAutomatedCleanup("startup");
});

