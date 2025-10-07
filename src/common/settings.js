export const STORAGE_KEYS = {
  generalOptions: "generalOptions",
  currentTabPreferences: "currentTabPreferences",
  globalCleanupPreferences: "globalCleanupPreferences",
};

export const TIME_RANGE_OPTIONS = [
  { id: "last15Minutes", label: "最近 15 分钟", seconds: 15 * 60 },
  { id: "lastHour", label: "最近 1 小时", seconds: 60 * 60 },
  { id: "last24Hours", label: "最近 24 小时", seconds: 24 * 60 * 60 },
  { id: "last7Days", label: "最近 7 天", seconds: 7 * 24 * 60 * 60 },
  { id: "last4Weeks", label: "最近 4 周", seconds: 28 * 24 * 60 * 60 },
  { id: "forever", label: "全部时间", seconds: null },
];

export const DATA_TYPE_OPTIONS = [
  { id: "cache", label: "缓存数据", key: "cache", supportsOrigins: true },
  { id: "cookies", label: "Cookie", key: "cookies", supportsOrigins: true },
  { id: "history", label: "历史记录", key: "history", supportsOrigins: false },
  { id: "localStorage", label: "本地存储", key: "localStorage", supportsOrigins: true },
  { id: "downloads", label: "下载记录", key: "downloads", supportsOrigins: false },
  { id: "passwords", label: "已保存的密码", key: "passwords", supportsOrigins: false },
];

export const BROWSER_EVENT_AUTOMATION = [
  "off",
  "startup",
  "shutdown",
];

export const DEFAULT_GENERAL_SETTINGS = {
  timeRange: "lastHour",
  dataTypes: {
    cache: true,
    cookies: true,
    history: false,
    localStorage: false,
    downloads: false,
    passwords: false,
  },
  automation: {
    enabled: false,
    threshold: 20,
    browserEvent: BROWSER_EVENT_AUTOMATION[0],
  },
};

export const DEFAULT_PANEL_SELECTION = {
  timeRange: DEFAULT_GENERAL_SETTINGS.timeRange,
  dataTypes: { ...DEFAULT_GENERAL_SETTINGS.dataTypes },
};

export const AUTOMATION_THRESHOLD = {
  min: 5,
  max: 50,
};

export function normalizeGeneralSettings(settings = {}) {
  const normalized = {
    timeRange: DEFAULT_GENERAL_SETTINGS.timeRange,
    dataTypes: { ...DEFAULT_GENERAL_SETTINGS.dataTypes },
    automation: { ...DEFAULT_GENERAL_SETTINGS.automation },
  };

  if (settings && typeof settings === "object") {
    if (
      typeof settings.timeRange === "string" &&
      TIME_RANGE_OPTIONS.some((option) => option.id === settings.timeRange)
    ) {
      normalized.timeRange = settings.timeRange;
    }

    if (settings.dataTypes && typeof settings.dataTypes === "object") {
      DATA_TYPE_OPTIONS.forEach(({ id }) => {
        if (typeof settings.dataTypes[id] === "boolean") {
          normalized.dataTypes[id] = settings.dataTypes[id];
        }
      });
    }

    if (settings.automation && typeof settings.automation === "object") {
      if (typeof settings.automation.enabled === "boolean") {
        normalized.automation.enabled = settings.automation.enabled;
      }
      const threshold = Number(settings.automation.threshold);
      if (Number.isFinite(threshold)) {
        const clamped = Math.min(
          AUTOMATION_THRESHOLD.max,
          Math.max(AUTOMATION_THRESHOLD.min, Math.round(threshold))
        );
        normalized.automation.threshold = clamped;
      }
      if (
        typeof settings.automation.browserEvent === "string" &&
        BROWSER_EVENT_AUTOMATION.includes(settings.automation.browserEvent)
      ) {
        normalized.automation.browserEvent = settings.automation.browserEvent;
      }
    }
  }

  return normalized;
}

export function derivePanelSelectionFromGeneral(settings = {}) {
  const normalized = normalizeGeneralSettings(settings);
  return {
    timeRange: normalized.timeRange,
    dataTypes: { ...normalized.dataTypes },
  };
}

export function normalizePanelSelection(selection = {}, fallback = DEFAULT_PANEL_SELECTION) {
  const normalized = {
    timeRange: fallback.timeRange,
    dataTypes: { ...fallback.dataTypes },
  };

  if (
    typeof selection.timeRange === "string" &&
    TIME_RANGE_OPTIONS.some((option) => option.id === selection.timeRange)
  ) {
    normalized.timeRange = selection.timeRange;
  }

  if (selection.dataTypes && typeof selection.dataTypes === "object") {
    DATA_TYPE_OPTIONS.forEach(({ id }) => {
      if (typeof selection.dataTypes[id] === "boolean") {
        normalized.dataTypes[id] = selection.dataTypes[id];
      }
    });
  }

  return normalized;
}

export function resolveSinceTimestamp(timeRangeId) {
  const option = TIME_RANGE_OPTIONS.find((item) => item.id === timeRangeId);
  if (!option) {
    const fallback = TIME_RANGE_OPTIONS.find(
      (item) => item.id === DEFAULT_GENERAL_SETTINGS.timeRange
    );
    if (!fallback || fallback.seconds === null) {
      return 0;
    }
    return Date.now() - fallback.seconds * 1000;
  }

  if (option.seconds === null) {
    return 0;
  }

  return Date.now() - option.seconds * 1000;
}
