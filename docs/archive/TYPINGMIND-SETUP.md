# TypingMind MCP Connector Setup Guide

This guide explains how to automatically configure TypingMind to work with the MCP Connector.

## Overview

The FictionLab App includes automatic configuration tools to set up TypingMind with your MCP Connector. This eliminates manual configuration and ensures all settings are correct.

## Automatic Setup (Recommended)

### Method 1: Using the Electron App UI

1. **Start the FictionLab App**
2. **Navigate to Dashboard**
3. **Click "Auto-Configure TypingMind"** button
4. The app will automatically:
   - Read your MCP Connector settings from the environment config
   - Create a TypingMind configuration file
   - Display setup instructions

### Method 2: Using the Command Line Script

From the application directory, run:

```bash
node scripts/configure-typingmind.js
```

This will:
- Read your current `.env` configuration
- Generate the TypingMind MCP configuration
- Display setup instructions with your specific URLs and tokens

### Method 3: Custom Configuration

If you need to use custom settings (e.g., external TypingMind instance):

```bash
node scripts/configure-typingmind.js --url http://localhost:3000 --token YOUR_TOKEN
```

Replace:
- `http://localhost:3000` with your TypingMind server URL
- `YOUR_TOKEN` with your auth token from the `.env` file

### Method 4: Programmatic Setup (JavaScript API)

```javascript
const { ipcRenderer } = require('electron');

// Auto-configure with default settings
const result = await ipcRenderer.invoke('typingmind:auto-configure');
console.log(result.message);
console.log('Server URL:', result.config.serverUrl);
console.log('Auth Token:', result.config.authToken);

// Or set custom configuration
const customResult = await ipcRenderer.invoke(
  'typingmind:set-custom-config',
  'http://localhost:3000',
  'your-auth-token-from-env'
);
```

## Manual Setup (If Needed)

If you prefer to set up manually or need to verify the configuration:

1. **Get Your Configuration Details**

   Run the auto-configuration script to display your settings:
   ```bash
   node scripts/configure-typingmind.js
   ```

2. **Open TypingMind**

   Navigate to `http://localhost:3000` (or your TypingMind URL)

3. **Access MCP Settings**

   - Click on **Settings** (gear icon)
   - Find **MCP Integration** or **MCP Connector** section
   - If you don't see this option, ensure you're using a version of TypingMind that supports MCP

4. **Enter Configuration**

   - **Server URL**: `http://localhost:50880` (or your custom URL)
   - **Auth Token**: Your MCP_AUTH_TOKEN from the `.env` file

5. **Connect**

   Click **Connect** or **Save** to establish the connection

6. **Verify Connection**

   - Check for a success message or green indicator
   - Try using an MCP tool to verify functionality

## Configuration File Location

The auto-configuration saves settings to:
```
%APPDATA%\mcp-electron-app\typingmind-mcp-config.json
```

On Windows, this is typically:
```
C:\Users\<YourUsername>\AppData\Roaming\mcp-electron-app\typingmind-mcp-config.json
```

## Example Configuration

Your generated configuration file will look like this:

```json
{
  "enabled": true,
  "serverUrl": "http://localhost:50880",
  "authToken": "0963c826350b86e30a4244c6511a0db6b9d5499ad44e46b61d20b5c71f83dd4f",
  "autoConnect": true,
  "configuredAt": "2025-11-11T12:00:00.000Z"
}
```

## Troubleshooting

### "MCP_AUTH_TOKEN not found" Error

**Solution**: Complete the environment setup in the Electron app first:
1. Open the app
2. Go to **Settings** → **Environment Configuration**
3. Generate or enter your MCP_AUTH_TOKEN
4. Save the configuration
5. Try auto-configuration again

### "TypingMind not installed" Error

**Solution**: Install TypingMind first:
1. In the Electron app, go to **Client Selection**
2. Select **TypingMind**
3. Click **Download TypingMind**
4. Wait for installation to complete
5. Try auto-configuration again

### Connection Fails in TypingMind

**Solution**:
1. Verify the MCP Connector is running:
   ```bash
   curl http://localhost:50880/ping
   ```
   Should return: `{"status":"ok"}`

2. Check that ports are correct in your `.env` file

3. Ensure Docker containers are running:
   - Open the app dashboard
   - Click **Start System** if needed
   - Wait for all services to show as "Healthy"

4. Verify auth token matches between `.env` and TypingMind

### Custom TypingMind Instance

If you're running TypingMind on a different port or server:

```bash
# Configure for custom instance
node scripts/configure-typingmind.js \
  --url http://localhost:3000 \
  --token YOUR_AUTH_TOKEN_FROM_ENV
```

## Available IPC Methods

For developers integrating with the auto-configuration:

- `typingmind:auto-configure` - Auto-configure with default settings
- `typingmind:set-custom-config` - Set custom URL and token
- `typingmind:get-config` - Get current configuration
- `typingmind:get-config-instructions` - Get setup instructions
- `typingmind:is-configured` - Check if configured
- `typingmind:reset-config` - Reset configuration

## Next Steps

After configuration:

1. **Test the Connection**
   - Open TypingMind
   - Try using an MCP tool
   - Check for successful responses

2. **Explore MCP Features**
   - Browse available tools
   - Try different MCP servers
   - Customize your workflow

3. **Monitor Logs**
   - Check Electron app logs for any issues
   - Use the dashboard to view container status

## Security Notes

- Keep your auth token secure
- Don't share configuration files containing tokens
- Use environment variables for sensitive data
- Regenerate tokens if compromised

## Support

If you encounter issues:

1. Check the logs: **Diagnostics** → **View Logs**
2. Export diagnostic report: **Diagnostics** → **Export Report**
3. Visit the troubleshooting guide: [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
4. Report issues: [GitHub Issues](https://github.com/RLRyals/MCP-Electron-App/issues)
