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

            # Wait for main menu
            page.wait_for_selector(".char-select-grid")
            page.screenshot(path="verification_start_screen_responsive.png")
            print("Start Screen Screenshot taken.")

            # Test Shop Navigation
            page.click("text=POWER UP")
            page.wait_for_selector(".shop-grid")
            page.screenshot(path="verification_shop.png")
            print("Shop Screenshot taken.")

            # Test Buy (if gold is mocked? No, default is 0. But button exists)
            # Just verify button exists

            # Test Done
            page.click("text=DONE")
            page.wait_for_selector(".char-select-grid")

            # Select character and start
            page.click(".char-select-icon") # Click first
            page.click("#startGameBtn")
            time.sleep(1)
            page.screenshot(path="verification_ingame_final.png")
            print("Ingame Screenshot taken.")

    finally:
        server.terminate()

if __name__ == "__main__":
    run()
