const ICON_BASE64 = {
  16: "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMElEQVR42mPgF9f6TwlmGMYG8C19iYGJNgCbZlyGMJCiGZshowbQIhaokg6GVl4AAOnoqIwX5vcOAAAAAElFTkSuQmCC",
  32: "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAV0lEQVR42u3WMREAIAxD0SiAEQ/4RhwqQAJlyFHu/pA5b2qq2vp6GQEAAOA7QBnzGBsgUn6LkKP8BiFXeRQhZ3kEAQAAAAD5L2GKLUixhin+AV4yAAAc2anAf0e8GK1oAAAAAElFTkSuQmCC",
  48: "iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAAh0lEQVR42u3Yuw2AQAwE0a0AQnqgb4qjCqgAJO6D7dUEzudFd7bWbb8qjwAAAAAAAAAAboDlOB8nLeAteiZGUfGjEIqMH4FQdHwvQhniexDKEt+KUKb4FgSAUoA/4r8iAAAAAKAQgIcMAL9Rk33AYiOz2IktrhIWdyGLyxzHXQAAAAAAAKBhbufyqb95VLSgAAAAAElFTkSuQmCC",
  128: "iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAABgUlEQVR42u3dy3ECMQBEwYkAH8mBvAnOUUAOLhcfvT68BDR93JX2c7091G0OAQAHAYAAEAACQAAIAAEgAASAABAAAkAACAABIAAEgAAQAAJAAAgAASAABIAAEACf1uX+++cAiA1eAzHDtyHM6G0MM34bwQzfhjDDtyHM+G0EM34bwYzfRjDjtxHM+G0EM34bwYzfRjDjtxEAAIDxywgAAMD4ZQQzfhsBAAAAAIDxswgAAMD4ZQQAAAAAAAAAYPwmAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACHwPAAAAAAAAAAAQ+C8AAAAg8G8gAAAAAAAEbgiBwB1BAAAAgXsCAQAAAncFQ+C2cAi8FwCBF0Mg8GaQV8MA8G4gAF4OBcDbwQB4PRyAAxF88/l9PYB3YTjlzI4C8AoIp53VkQD+E8TpZ5MAIAAEgAAQAAJAAAgASAAAHAIADgIAASAABAAAkAACAABIAAEgAAQAAJAAAgAAaCDegKkUCoFg1+/xQAAAABJRU5ErkJggg=="
};

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const buffer = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    buffer[i] = binary.charCodeAt(i);
  }
  return buffer;
}

async function base64ToImageData(size, base64) {
  const blob = new Blob([base64ToUint8Array(base64)], { type: "image/png" });
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, size, size);
  const imageData = ctx.getImageData(0, 0, size, size);
  bitmap.close();
  return imageData;
}

let cachedIconsPromise;

async function decodeIcons() {
  if (!cachedIconsPromise) {
    cachedIconsPromise = Promise.all(
      Object.entries(ICON_BASE64).map(async ([size, base64]) => {
        const numericSize = Number(size);
        const imageData = await base64ToImageData(numericSize, base64);
        return [numericSize, imageData];
      })
    ).then((entries) => Object.fromEntries(entries));
  }
  return cachedIconsPromise;
}

async function applyActionIcons() {
  try {
    const imageDataMap = await decodeIcons();
    await chrome.action.setIcon({ imageData: imageDataMap });
  } catch (error) {
    console.error("Failed to apply action icons", error);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  applyActionIcons();
});

chrome.runtime.onStartup.addListener(() => {
  applyActionIcons();
});
