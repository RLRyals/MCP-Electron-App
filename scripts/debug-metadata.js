const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const appData = process.env.APPDATA;
const candidates = [
    'FictionLab',
    'MCP-Electron-App',
    'Electron',
    'fictionlab',
    'mcp-electron-app'
];

let output = '';

async function run() {
    output += `AppData: ${appData}\n`;

    let foundPath = null;

    for (const name of candidates) {
        const dir = path.join(appData, name);
        output += `Checking dir: ${dir}\n`;
        if (fs.existsSync(dir)) {
            output += `  Exists.\n`;
            const repoDir = path.join(dir, 'repositories', 'typing-mind');
            if (fs.existsSync(repoDir)) {
                output += `  FOUND repositories/typing-mind in ${dir}\n`;
                foundPath = dir;

                const metadataPath = path.join(dir, '.metadata.json');
                if (fs.existsSync(metadataPath)) {
                    output += `  FOUND .metadata.json\n`;
                    output += fs.readFileSync(metadataPath, 'utf8') + '\n';
                } else {
                    output += `  .metadata.json NOT FOUND in ${dir}\n`;
                }
                break;
            }
        } else {
            output += `  Does not exist.\n`;
        }
    }

    if (!foundPath) {
        output += 'Could not find repositories/typing-mind in candidate directories.\n';
    }

    output += '----------------------------------------\n';
    output += 'Checking remote HEAD for TypingMind/typingmind:\n';
    try {
        const stdout = execSync('git ls-remote https://github.com/TypingMind/typingmind.git HEAD').toString();
        output += `REMOTE HEAD: ${stdout.trim()}\n`;
    } catch (e) {
        output += `Error checking remote: ${e.message}\n`;
    }

    fs.writeFileSync(path.join(__dirname, 'debug-output.txt'), output);
    console.log('Done writing to debug-output.txt');
}

run();
