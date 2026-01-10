---
name: fictionlab-workflow
description: Execute FictionLab workflows. Run node ipc-client.js with list, get, or execute commands.
allowed-tools: Bash(node:*)
---

When the user wants to interact with FictionLab workflows, use node to run ipc-client.js:

**List workflows:**
```bash
node ipc-client.js list
```

**Get workflow:**
```bash
node ipc-client.js get <workflow-id>
```

**Execute workflow:**
```bash
node ipc-client.js execute <workflow-id>
```

**Execute with options:**
```bash
node ipc-client.js execute <workflow-id> --workspace "/path" --variables '{"key":"value"}'
```

FictionLab app must be running.
