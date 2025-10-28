
from playwright.sync_api import sync_playwright, expect
import os

def run_verification():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        # Get the absolute path to the HTML file
        file_path = os.path.abspath('ratato.html')

        # Navigate to the local HTML file
        page.goto(f'file://{file_path}')

        # Start the game by clicking on the first character card
        page.locator(".character-card").first.click()

        # Wait for the game object and player to be initialized
        page.wait_for_function('() => typeof game !== "undefined" && game.player')

        # Level up the player to trigger the upgrade screen
        page.evaluate('() => { game.player.gainXp(game.player.xpToNextLevel); }')

        # Wait for the upgrade screen to be visible
        upgrade_screen = page.locator('#upgradeScreen')
        expect(upgrade_screen).to_be_visible()

        # Take a screenshot of the upgrade screen
        page.screenshot(path='jules-scratch/verification/verification.png')

        # Verify the number of upgrade options
        upgrade_options = page.locator('#upgradeOptions .upgrade-card')
        expect(upgrade_options).to_have_count(3)

        # Verify the currency is displayed as "Points"
        purchase_summary = page.locator('#purchaseSummary')
        expect(purchase_summary).to_contain_text('Points')

        browser.close()

if __name__ == '__main__':
    run_verification()
