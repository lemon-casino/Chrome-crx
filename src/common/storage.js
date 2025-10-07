/**
 * storage.js 封装与 chrome.storage 的交互逻辑，便于未来扩展持久化策略。
 */

import { hasChromeRuntime } from "./utils.js";

/**
 * StorageService 提供统一的异步接口来读取和写入扩展配置。
 */
export class StorageService {
  constructor(area = "sync") {
    this.area = area;
    this.ready = this.#init();
    this.memoryFallback = {};
  }

  async #init() {
    if (!hasChromeRuntime() || !chrome.storage || !chrome.storage[this.area]) {
      console.warn(
        `[Tab Clean Master] 当前环境缺少 chrome.storage.${this.area}，将使用内存存储作为回退方案。`
      );
      return false;
    }
    return true;
  }

  /**
   * 读取存储中的键值。
   * @param {string | string[]} keys
   * @returns {Promise<Record<string, unknown>>}
   */
  async get(keys) {
    const hasStorage = await this.ready;
    if (!hasStorage) {
      if (Array.isArray(keys)) {
        return keys.reduce((acc, key) => {
          acc[key] = this.memoryFallback[key];
          return acc;
        }, {});
      }
      if (typeof keys === "string") {
        return { [keys]: this.memoryFallback[keys] };
      }
      return { ...this.memoryFallback };
    }

    return new Promise((resolve, reject) => {
      try {
        chrome.storage[this.area].get(keys, resolve);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 写入存储。
   * @param {Record<string, unknown>} items
   * @returns {Promise<void>}
   */
  async set(items) {
    const hasStorage = await this.ready;
    if (!hasStorage) {
      Object.assign(this.memoryFallback, items);
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        chrome.storage[this.area].set(items, () => resolve());
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 移除指定键。
   * @param {string | string[]} keys
   * @returns {Promise<void>}
   */
  async remove(keys) {
    const hasStorage = await this.ready;
    if (!hasStorage) {
      if (Array.isArray(keys)) {
        keys.forEach((key) => delete this.memoryFallback[key]);
      } else {
        delete this.memoryFallback[keys];
      }
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        chrome.storage[this.area].remove(keys, () => resolve());
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 清空存储区域。
   * @returns {Promise<void>}
   */
  async clear() {
    const hasStorage = await this.ready;
    if (!hasStorage) {
      this.memoryFallback = {};
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        chrome.storage[this.area].clear(() => resolve());
      } catch (error) {
        reject(error);
      }
    });
  }
}
