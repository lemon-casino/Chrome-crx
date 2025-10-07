/**
 * options.js 为通用设置页面提供基础的模块化结构。
 * 当前阶段预留事件注册与存储交互接口，便于后续阶段直接扩展。
 */

import { StorageService } from "../common/storage.js";

/**
 * 负责初始化选项页面，未来将加载用户配置并绑定事件。
 */
async function initOptionsPage() {
  try {
    const storage = new StorageService();
    await storage.ready;
    // TODO: 在后续阶段填充界面并同步存储的设置。
    console.info("[Tab Clean Master] 通用选项页面初始化完成。");
  } catch (error) {
    console.error("[Tab Clean Master] 初始化失败", error);
  }
}

initOptionsPage();
