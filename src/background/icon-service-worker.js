import { StorageService } from "../common/storage.js";
import {
  DATA_TYPE_OPTIONS,
  DEFAULT_GENERAL_SETTINGS,
  STORAGE_KEYS,
  normalizeGeneralSettings,
  resolveSinceTimestamp,
} from "../common/settings.js";

const ICON_PATHS = {
  16: "assets/icons/Chrome.png",
  32: "assets/icons/Chrome.png",
  48: "assets/icons/Chrome.png",
};

async function loadIconImageData(size, path) {
  const response = await fetch(chrome.runtime.getURL(path));
  if (!response.ok) {
    throw new Error(`Failed to load icon: ${path} (${response.status})`);
  }

  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);

  try {
    const canvas = new OffscreenCanvas(size, size);
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Failed to acquire OffscreenCanvas 2D context");
    }

    context.drawImage(bitmap, 0, 0, size, size);
    return context.getImageData(0, 0, size, size);
  } finally {
    bitmap.close();
  }
}

let cachedIconsPromise;

async function loadIcons() {
  if (!cachedIconsPromise) {
    cachedIconsPromise = Promise.all(
      Object.entries(ICON_PATHS).map(async ([size, path]) => {
        const numericSize = Number(size);
        const imageData = await loadIconImageData(numericSize, path);
        return [numericSize, imageData];
      })
    ).then((entries) => Object.fromEntries(entries));
  }

  return cachedIconsPromise;
}

async function applyActionIcons() {
  try {
    const imageDataMap = await loadIcons();
    await chrome.action.setIcon({ imageData: imageDataMap });
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

