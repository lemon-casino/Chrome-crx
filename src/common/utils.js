/**
 * 工具函数模块，集中管理通用的辅助方法。
 * 随着项目推进可持续扩展，确保复用性与可测试性。
 */

/**
 * 判断当前运行环境是否存在 chrome API。
 * 在开发与测试环境中，某些 API 可能不可用，需要做兼容处理。
 * @returns {boolean}
 */
export function hasChromeRuntime() {
  return typeof chrome !== "undefined" && typeof chrome.runtime !== "undefined";
}

/**
 * 一个空操作函数，作为默认回调占位符，避免函数存在性判断。
 */
export function noop() {}

/**
 * 等待指定的毫秒数，用于模拟异步流程或延迟操作。
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
