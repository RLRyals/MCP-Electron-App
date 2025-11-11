# Security Notes for TypingMind Auto-Configuration

## Sensitive Information Protection

### Auth Token Security

The MCP Auth Token (`MCP_AUTH_TOKEN`) is a **sensitive credential** that should be protected:

✅ **What We Do:**
- Generate secure random tokens (64-character hex)
- Store only in `.env` file (not in git)
- Display only partial token in UI (first 16 chars + "...")
- Log tokens as masked (`****`)
- Never include in documentation or screenshots
- Transmit only over localhost connections

❌ **What NOT to Do:**
- Don't commit `.env` files to version control
- Don't share auth tokens publicly
- Don't include tokens in issue reports
- Don't hardcode tokens in documentation
- Don't log full tokens

### Token Generation

Tokens are automatically generated during setup:
```typescript
// From src/main/env-config.ts
export function generateAuthToken(): string {
  // Generate a 32-byte random token in hexadecimal format
  const token = crypto.randomBytes(32).toString('hex');
  return token;
}
```

### Token Storage

**`.env` File Location:**
- Windows: `C:\Users\<username>\AppData\Roaming\mcp-electron-app\.env`
- Mac: `/Users/<username>/Library/Application Support/mcp-electron-app/.env`
- Linux: `/home/<username>/.config/mcp-electron-app/.env`

**Permissions:**
- User-only read/write access
- Not world-readable
- Protected by OS user account

### Configuration File

**`typingmind-mcp-config.json` Location:**
- Same directory as `.env` file
- Contains copy of auth token
- Used for auto-configuration
- Protected by OS user permissions

### UI Display

When showing configuration in the UI:
```typescript
// Show only first 16 characters
const displayToken = config.authToken.substring(0, 16) + '...';
```

Example:
```
Auth Token: 0963c826350b86e3...
```

### Logging

Tokens should be masked in logs:
```typescript
logWithCategory('info', LogCategory.DOCKER,
  `Auth Token: ${MCP_AUTH_TOKEN.substring(0, 8)}****`
);
```

### Network Transmission

The auth token is transmitted:
- ✅ Only to `localhost:50880` (MCP Connector)
- ✅ In `Authorization: Bearer <token>` header
- ✅ Over HTTP (acceptable for localhost only)
- ❌ Never sent to external services
- ❌ Never sent over public networks

### Documentation Security

All documentation files should use placeholders:
- ✅ `<auth-token>`
- ✅ `<generated-secure-token>`
- ✅ `YOUR_AUTH_TOKEN`
- ✅ `****`
- ❌ Never actual token values

### Git Security

The `.gitignore` should include:
```gitignore
.env
.env.*
*.env
typingmind-mcp-config.json
```

### Token Regeneration

Users can regenerate tokens:
1. Delete or edit `.env` file
2. Restart the app
3. Complete setup wizard again
4. New token automatically generated

Or programmatically:
```typescript
const newToken = await window.electronAPI.envConfig.regenerateToken();
```

### Password Security

Similar protections apply to `POSTGRES_PASSWORD`:
- Generated using secure random alphanumeric strings
- Stored only in `.env`
- Masked in logs
- Never included in documentation

## Best Practices

### For Developers

1. **Never commit `.env` files**
   ```bash
   git status  # Verify .env is ignored
   ```

2. **Use placeholders in docs**
   ```markdown
   Auth Token: <auth-token>
   Password: <generated-password>
   ```

3. **Mask in logs**
   ```typescript
   logger.info(`Token: ${token.substring(0, 8)}****`);
   ```

4. **Validate token format**
   ```typescript
   if (!token || token.length !== 64) {
     throw new Error('Invalid token format');
   }
   ```

### For Users

1. **Don't share your `.env` file**
2. **Don't post tokens in issue reports**
3. **Don't screenshot configuration containing tokens**
4. **Regenerate if accidentally exposed**

### For Support

When helping users:
- Ask for "first 8 characters" of token for verification
- Never ask for full token
- Instruct users to regenerate if compromised

## Security Checklist

Before committing code:
- [ ] No hardcoded tokens
- [ ] Tokens masked in logs
- [ ] `.env` in `.gitignore`
- [ ] Documentation uses placeholders
- [ ] UI shows partial tokens only
- [ ] No tokens in error messages
- [ ] Configuration files excluded from git

## Incident Response

If a token is accidentally exposed:

1. **Immediate Actions:**
   - Regenerate the token
   - Update `.env` file
   - Restart MCP system
   - Update TypingMind configuration

2. **If Publicly Exposed:**
   - Rotate all credentials
   - Check logs for unauthorized access
   - Review recent system activity

3. **Prevention:**
   - Review security checklist
   - Update documentation
   - Educate team members

## Summary

🔒 **Security is Critical**
- Auth tokens are sensitive credentials
- Must be protected at all times
- Never include in documentation or commits
- Always use placeholders in examples
- Mask in logs and UI

✅ **Our Implementation**
- Automatic secure generation
- Protected storage in `.env`
- Masked display and logging
- Localhost-only transmission
- Easy regeneration

The auto-configuration system handles tokens securely by default! 🛡️
