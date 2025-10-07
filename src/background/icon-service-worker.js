const ICON_PATHS = {
  16: "assets/icons/icon16.png",
  32: "assets/icons/icon32.png",
  48: "assets/icons/icon48.png",
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

chrome.runtime.onInstalled.addListener(() => {
  applyActionIcons();
});

chrome.runtime.onStartup.addListener(() => {
  applyActionIcons();
});
