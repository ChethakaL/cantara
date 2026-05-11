function findLocalChromeExecutable() {
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ];
  return candidates.find((candidate) => {
    try {
      return require("fs").existsSync(candidate);
    } catch {
      return false;
    }
  });
}

export async function renderHtmlToPdfBuffer(html: string) {
  const chromium = (await import("@sparticuz/chromium")).default;
  const puppeteer = await import("puppeteer-core");
  const localChrome = findLocalChromeExecutable();
  const isLocalChrome = process.platform === "darwin";
  const executablePath = process.platform === "darwin"
    ? localChrome
    : await chromium.executablePath().catch(() => localChrome);
  const browser = await puppeteer.launch({
    args: isLocalChrome
      ? ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
      : chromium.args,
    defaultViewport: { width: 1280, height: 900 },
    executablePath,
    headless: true,
    timeout: 15000,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: 10000 });
    const pdf = await page.pdf({
      format: "Letter",
      printBackground: true,
      margin: {
        top: "0.5in",
        right: "0.5in",
        bottom: "0.5in",
        left: "0.5in",
      },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
