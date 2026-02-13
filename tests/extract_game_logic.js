const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, '..', 'ratato.html');
const outputFile = path.join(__dirname, 'ratato_logic.mjs');

try {
    const fileContent = fs.readFileSync(inputFile, 'utf8');

    const startTag = '<script type="module">';
    const endTag = '</script>';

    const startIndex = fileContent.indexOf(startTag);
    if (startIndex === -1) {
        throw new Error('Start script tag not found');
    }

    const scriptStart = startIndex + startTag.length;
    const endIndex = fileContent.indexOf(endTag, scriptStart);
    if (endIndex === -1) {
        throw new Error('End script tag not found');
    }

    let scriptContent = fileContent.substring(scriptStart, endIndex);

    // Append exports
    // We export the classes and constants we need for testing
    // Note: We might need to export more if tests require them
    const exports = `
export { Rat, WEAPONS, CHARACTERS, Entity, Game, VIEWPORT_RADIUS, WORLD_RADIUS, WORLD_CENTER_X, WORLD_CENTER_Y };
`;
    scriptContent += exports;

    fs.writeFileSync(outputFile, scriptContent);
    console.log(`Successfully extracted game logic to ${outputFile}`);

} catch (err) {
    console.error('Error extracting game logic:', err);
    process.exit(1);
}
