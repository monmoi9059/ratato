# Testing Strategy for Ratato

This project uses a custom testing setup to handle the single-file nature of `ratato.html` while allowing for robust unit testing of game logic.

## Overview

The testing process involves extracting the game logic from `ratato.html` into a temporary module, which is then imported by the test suite. This ensures that tests run against the actual game code without requiring manual synchronization.

## Prerequisites

- Node.js (v20 or later recommended for native test runner support)

## Running Tests

To run the tests, execute the following command from the project root:

```bash
node tests/extract_game_logic.js && node --test tests/test_rat_weapons.mjs
```

### Explanation of Steps:

1.  `node tests/extract_game_logic.js`: This script reads `ratato.html`, extracts the JavaScript code within the `<script type="module">` block, appends necessary exports, and writes it to `tests/ratato_logic.mjs`.
2.  `node --test tests/test_rat_weapons.mjs`: This runs the test suite using Node's native test runner. The test file imports the extracted logic and a setup file (`tests/setup_globals.js`) that mocks browser globals (window, document, canvas).

## Directory Structure

-   `tests/`: Contains all testing-related files.
    -   `extract_game_logic.js`: Utility script for code extraction.
    -   `setup_globals.js`: Mocks for browser environment.
    -   `test_rat_weapons.mjs`: Test suite for Rat weapon logic.
    -   `ratato_logic.mjs`: (Generated) Extracted game logic.

## Adding New Tests

1.  Create a new test file in `tests/` (e.g., `tests/test_enemy_logic.mjs`).
2.  Import `setup_globals.js` at the top.
3.  Import the classes/functions you need from `./ratato_logic.mjs`.
4.  Write tests using `node:test` and `node:assert`.
5.  Run the tests using the command above.

## Notes

-   If you modify `ratato.html`, remember that the tests will run against the *new* content only after you run the extraction script again.
-   The extraction script is simple and assumes the main script is inside `<script type="module">`.
