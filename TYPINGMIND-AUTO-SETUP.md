# TypingMind Auto-Configuration

This guide explains how to automatically set up TypingMind with your MCP Connector AND all 8 MCP servers - no command line required!

## For Non-Technical Users

### Quick Setup (3 Simple Steps!)

1. **Start Your MCP Electron App**
   - Open the application
   - The dashboard will appear
   - Click "Start System" if not already running
   - Wait until all services show as "Healthy"

2. **Click "Configure Typing Mind" Button**
   - On the dashboard, find the "Configure Typing Mind" button
   - Click it once
   - Wait for the success message showing **8 servers configured**

3. **Open Typing Mind and Connect**
   - Click the "Open Typing Mind" button
   - In Typing Mind, go to Settings → MCP Integration
   - Copy and paste the Server URL and Auth Token from the popup dialog
   - Click "Connect"
   - You should now see tools from all 8 MCP servers!

That's it! All servers are automatically configured and running! 🎉

## What Gets Configured Automatically

When you click "Configure Typing Mind", the app automatically:

✓ Reads your MCP Connector settings (port and auth token) from `.env`
✓ Discovers all 8 MCP writing servers on your system
✓ Builds the complete server configuration with correct paths
✓ Registers and starts all servers with the MCP Connector
✓ Creates a configuration file with your settings
✓ Shows you a popup with everything you need

**All 8 Servers Configured:**
- book-planning-server
- chapter-planning-server
- charater-planning-server
- core-continuity-server
- reporting-server
- review-server
- scene-server
- series-planning-server

## Configuration Details

Your configuration will be automatically saved with:

- **Server URL**: `http://localhost:50880` (or your custom port)
- **Auth Token**: Your secure authentication token
- **Auto-Connect**: Enabled for convenience

## Troubleshooting

### "Configuration Failed" Error

**Solution**: Make sure you've completed the app setup first:
1. Go to Settings → Environment Configuration
2. Make sure all fields are filled in
3. Click "Save"
4. Try configuring Typing Mind again

### Can't Find "Configure Typing Mind" Button

**Solution**:
1. Make sure you're on the Dashboard tab
2. Look in the "Quick Actions" section
3. The button is next to "Open Typing Mind"

### Typing Mind Won't Connect

**Solution**:
1. Make sure the system is running (click "Start System" if needed)
2. Wait for all services to show as "Healthy"
3. Double-check that you copied the FULL auth token (not just part of it)
4. Try clicking "Configure Typing Mind" again to get fresh settings

## What If I Have a Custom Setup?

If you're running Typing Mind on a different URL (like `localhost:3000`), you can still use the configuration:

1. Click "Configure Typing Mind"
2. Copy the Auth Token from the popup
3. Manually enter your custom URL in Typing Mind
4. Use the copied Auth Token

## Security Note

Your authentication token is sensitive. The app:
- Never shares it over the internet
- Stores it securely on your computer
- Only shows it to you when needed

## Need More Help?

- Check the full documentation: [docs/TYPINGMIND-SETUP.md](docs/TYPINGMIND-SETUP.md)
- View logs: Click Diagnostics → View Logs
- Report issues: [GitHub Issues](https://github.com/RLRyals/MCP-Electron-App/issues)

---

**Remember**: You don't need to use the command line at all. Everything works through the graphical interface! 😊
