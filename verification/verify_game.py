from playwright.sync_api import sync_playwright
import time

def verify_game():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            print("Navigating to game...")
            page.goto("http://localhost:8080/ratato.html")

            # Wait for start screen
            print("Waiting for start screen...")
            page.wait_for_selector("#startScreen")

            # Take screenshot of start screen
            page.screenshot(path="verification/start_screen.png")
            print("Start screen captured.")

            # Click on 'The Brawler' (first character)
            # The character cards are inside #characterOptions
            # We can just click the text "The Brawler"
            print("Clicking character...")
            page.click("text=The Brawler")

            # Wait for game to start (start screen hidden)
            page.wait_for_selector("#startScreen", state="hidden")

            # Wait for a few frames
            time.sleep(2)

            # Take screenshot of gameplay
            print("Taking gameplay screenshot...")
            page.screenshot(path="verification/gameplay.png")
            print("Gameplay captured.")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_game()
