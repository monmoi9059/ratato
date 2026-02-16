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

            # Wait for character options to load
            page.wait_for_selector(".character-card")

            # Take screenshot of the start screen showing Rattonio etc.
            page.screenshot(path="verification_start_screen.png")
            print("Screenshot taken.")

            # Click on Rattonio to start game
            page.click("text=Rattonio Belpaese")

            # Wait a bit for game to start
            time.sleep(1)

            # Take in-game screenshot
            page.screenshot(path="verification_ingame.png")
            print("Ingame Screenshot taken.")

    finally:
        server.terminate()

if __name__ == "__main__":
    run()
