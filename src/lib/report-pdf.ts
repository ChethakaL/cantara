import { existsSync } from "fs";

function findLocalChromeExecutable() {
  // Check env var first (set in Dockerfile as /usr/bin/chromium-browser)
  if (process.env.PUPPETEER_EXECUTABLE_PATH && existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  const candidates = [
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ];
  return candidates.find((candidate) => {
    try {
      return existsSync(candidate);
    } catch {
      return false;
    }
  });
}

export async function renderHtmlToPdfBuffer(html: string) {
  const puppeteer = await import("puppeteer-core");
  const isDarwin = process.platform === "darwin";
  
  let executablePath = findLocalChromeExecutable();
  let chromiumArgs: string[] = [];

  // On non-Darwin (Linux/Docker), if no system chromium is found, try @sparticuz/chromium fallback
  if (!isDarwin && !executablePath) {
    try {
      const chromium = (await import("@sparticuz/chromium")).default;
      executablePath = await chromium.executablePath();
      chromiumArgs = chromium.args;
    } catch (e) {
      console.warn("[report-pdf] @sparticuz/chromium fallback failed:", e);
    }
  }

  if (!executablePath) {
    throw new Error("Chromium executable not found. Ensure chromium is installed in the environment.");
  }

  const browser = await puppeteer.launch({
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage", // Critical for Docker stability
      "--disable-gpu",
      "--no-zygote",
      "--single-process", // Can help in resource-constrained environments like Alpine
      ...chromiumArgs,
    ],
    defaultViewport: { width: 1280, height: 900 },
    executablePath,
    headless: true,
    timeout: 30000, // Increased launch timeout
  });

  try {
    const page = await browser.newPage();
    // Relaxed networkidle2 to handle reports with many assets/images better
    await page.setContent(html, { 
      waitUntil: "networkidle2", 
      timeout: 60000 
    });
    
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
    // Ensure browser is closed even on page error
    if (browser) {
      await browser.close().catch(err => console.error("[report-pdf] Error closing browser:", err));
    }
  }
}
