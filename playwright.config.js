import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5001",
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
    screenshot: "only-on-failure",
  },
  webServer: {
    command:
      process.platform === "win32"
        ? ".venv\\Scripts\\python.exe app.py"
        : ".venv/bin/python app.py",
    url: "http://127.0.0.1:5001/api/health",
    reuseExistingServer: false,
    env: {
      DB_MODE: "demo",
      PORT: "5001",
      DEMO_DB_PATH: "instance/browser-tests.db",
    },
  },
});
