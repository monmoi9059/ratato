import os

def build():
    # Paths
    SRC_DIR = 'src'
    INDEX_PATH = os.path.join(SRC_DIR, 'index.html')
    CSS_PATH = os.path.join(SRC_DIR, 'styles.css')
    JS_PATH = os.path.join(SRC_DIR, 'game.js')
    OUTPUT_FILE = 'ratato.html'

    print(f"Building {OUTPUT_FILE} from {SRC_DIR}...")

    try:
        # Read HTML template
        with open(INDEX_PATH, 'r', encoding='utf-8') as f:
            html_content = f.read()

        # Read CSS
        with open(CSS_PATH, 'r', encoding='utf-8') as f:
            css_content = f.read()

        # Read JS
        with open(JS_PATH, 'r', encoding='utf-8') as f:
            js_content = f.read()

        # Inject CSS
        # We wrap it in <style> tags
        css_block = f"<style>\n{css_content}\n</style>"
        html_content = html_content.replace('<!-- {{CSS}} -->', css_block)

        # Inject JS
        # We wrap it in <script type="module"> tags
        js_block = f"<script type=\"module\">\n{js_content}\n</script>"
        html_content = html_content.replace('<!-- {{JS}} -->', js_block)

        # Write output
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            f.write(html_content)

        print(f"Successfully created {OUTPUT_FILE}")

    except FileNotFoundError as e:
        print(f"Error: Could not find file {e.filename}")
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == '__main__':
    build()
