import subprocess
import time
from playwright.sync_api import sync_playwright

def run():
    # Start server
    server = subprocess.Popen(["python3", "-m", "http.server", "8000"])
    time.sleep(2) # Wait for start

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()
            page.set_viewport_size({"width": 1280, "height": 720})
            page.goto("http://localhost:8000/rat_survivors.html")

            # Wait for grid to load (New CSS class)
            page.wait_for_selector(".char-select-grid")

            # Take screenshot of the new selection screen
            page.screenshot(path="verification_start_screen_new.png")
            print("Start Screen Screenshot taken.")

            # Select Rattonio (First icon should be auto-selected, but let's click another if possible or verify info panel)
            # Check if info panel is visible
            page.wait_for_selector("#charInfoPanel")

            # Click Start Button
            page.click("#startGameBtn")

            # Wait a bit for game to start
            time.sleep(1)

            # Take in-game screenshot
            page.screenshot(path="verification_ingame_new.png")
            print("Ingame Screenshot taken.")

    finally:
        server.terminate()

if __name__ == "__main__":
    run()
