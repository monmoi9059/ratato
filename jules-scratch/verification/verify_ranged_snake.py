
from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        # Listen for console events and print them
        page.on("console", lambda msg: print(f"Browser console: {msg.text}"))

        page.goto("http://localhost:8080/ratato.html")

        # Wait for the page to be fully loaded
        page.wait_for_load_state("networkidle")

        page.screenshot(path="jules-scratch/verification/verification.png")
        browser.close()

if __name__ == "__main__":
    run()
