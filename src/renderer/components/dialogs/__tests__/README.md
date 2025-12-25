# Dialog Component Accessibility Tests

## Test Files

### NodeConfigDialog.a11y.test.tsx

Comprehensive accessibility tests for the NodeConfigDialog component.

**Coverage:**
- Automated accessibility scanning with jest-axe
- ARIA attributes (dialog, tablist, tabs, tabpanels)
- Keyboard navigation (Tab, Arrow keys, Home, End, Esc, Ctrl+Enter)
- Focus management and tab trapping
- Screen reader support (labels, announcements, descriptions)
- Form validation error handling
- Required field marking
- Tab error indicators

**Test Scenarios:**
- Initial render without violations
- Validation errors display
- Different node types (planning, writing, gate, user-input)
- Tab navigation and selection
- Keyboard shortcuts
- Focus trapping within dialog
- Error announcements

**Key Tests:**
- 50+ test cases
- Tests all 5 tabs (Basic Info, Configuration, Provider, Context, Advanced)
- Tests roving tabindex pattern
- Tests aria-live error announcements
- Tests keyboard-only navigation

---

## Running These Tests

### All Dialog Tests
```bash
npm test -- src/renderer/components/dialogs/__tests__
```

### Only Accessibility Tests
```bash
npm run test:a11y
```

### Watch Mode
```bash
npm run test:a11y:watch
```

---

## WCAG Compliance

All tests verify compliance with:
- WCAG 2.1 Level AA
- Section 508
- ARIA Authoring Practices Guide

---

## Related Documentation

- [ACCESSIBILITY_TEST_GUIDE.md](../../../../../ACCESSIBILITY_TEST_GUIDE.md) - Complete testing guide
- [NodeConfigDialog.tsx](../NodeConfigDialog.tsx) - Component implementation
