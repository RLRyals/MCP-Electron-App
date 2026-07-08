# Accessibility Quick Reference

Quick checklist for developers implementing accessible components.

## Running Tests

```bash
npm run test:a11y              # Run all accessibility tests
npm run test:a11y:watch        # Watch mode
npm test                       # Run all tests
```

## Essential ARIA Patterns

### Dialog
```tsx
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="title-id"
  aria-describedby="desc-id"
>
  <h2 id="title-id">Dialog Title</h2>
  <p id="desc-id">Description</p>
</div>
```

### Tabs
```tsx
<div role="tablist" aria-label="Tabs">
  <button
    role="tab"
    aria-selected={isActive}
    aria-controls="panel-id"
    tabIndex={isActive ? 0 : -1}
  >
    Tab Label
  </button>
</div>
<div role="tabpanel" id="panel-id" aria-labelledby="tab-id">
  Panel Content
</div>
```

### Tree
```tsx
<div role="tree" aria-label="Tree Label">
  <div
    role="treeitem"
    aria-expanded={isExpanded}
    aria-label="Item label"
  >
    <div role="group">
      <div role="treeitem">Child</div>
    </div>
  </div>
</div>
```

### Form Validation
```tsx
<label htmlFor="input-id">
  Label <span aria-label="required">*</span>
</label>
<input
  id="input-id"
  aria-required="true"
  aria-invalid={hasError}
  aria-describedby={hasError ? "error-id" : "help-id"}
/>
{hasError && (
  <div id="error-id" role="alert">
    Error message
  </div>
)}
<div id="help-id">Help text</div>
```

## Keyboard Support

### Required Keys
- **Tab/Shift+Tab** - Navigate between focusable elements
- **Enter** - Activate buttons, submit forms
- **Space** - Activate buttons, toggle checkboxes
- **Esc** - Close dialogs, cancel operations
- **Arrow Keys** - Navigate within components (tabs, trees, lists)

### Tab Pattern
```tsx
const handleKeyDown = (e: React.KeyboardEvent) => {
  switch (e.key) {
    case 'ArrowRight':
    case 'ArrowDown':
      // Move to next tab
      break;
    case 'ArrowLeft':
    case 'ArrowUp':
      // Move to previous tab
      break;
    case 'Home':
      // Move to first tab
      break;
    case 'End':
      // Move to last tab
      break;
  }
};
```

### Tree Pattern
```tsx
const handleKeyDown = (e: React.KeyboardEvent) => {
  switch (e.key) {
    case 'ArrowDown':
      // Move to next visible item
      break;
    case 'ArrowUp':
      // Move to previous visible item
      break;
    case 'ArrowRight':
      // Expand if collapsed, or move to first child
      break;
    case 'ArrowLeft':
      // Collapse if expanded, or move to parent
      break;
    case 'Enter':
    case ' ':
      // Activate item
      break;
  }
};
```

## Focus Management

### Roving Tabindex
Only one element in a group should have `tabIndex={0}`, others should have `tabIndex={-1}`.

```tsx
<div role="tablist">
  <button role="tab" tabIndex={isSelected ? 0 : -1}>Tab 1</button>
  <button role="tab" tabIndex={isSelected ? 0 : -1}>Tab 2</button>
</div>
```

### Focus Trap (Dialogs)
```tsx
const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === 'Tab') {
    const focusableElements = getFocusableElements();
    const first = focusableElements[0];
    const last = focusableElements[focusableElements.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
};
```

### Auto-Focus
```tsx
const inputRef = useRef<HTMLInputElement>(null);

useEffect(() => {
  if (isOpen) {
    setTimeout(() => inputRef.current?.focus(), 100);
  }
}, [isOpen]);

<input ref={inputRef} />
```

## Screen Reader Support

### Hide Decorative Content
```tsx
<span aria-hidden="true">🎨</span>
```

### Accessible Names
```tsx
// Visible label
<label htmlFor="input">Label</label>
<input id="input" />

// aria-label (no visible label)
<button aria-label="Close dialog">✕</button>

// aria-labelledby (reference to existing text)
<h2 id="title">Dialog Title</h2>
<div aria-labelledby="title">...</div>
```

### Live Regions
```tsx
// Polite (non-intrusive)
<div role="status" aria-live="polite">
  Loading...
</div>

// Assertive (important)
<div role="alert" aria-live="assertive">
  Error occurred!
</div>

// Alert (shorthand for assertive)
<div role="alert">
  Form submission failed
</div>
```

## Common Mistakes

### ❌ Don't Do This
```tsx
// Missing label
<input placeholder="Name" />

// Wrong tabindex
<div tabIndex={1}>Click me</div>

// Keyboard trap
<input onKeyDown={(e) => e.preventDefault()} />

// Missing role
<div onClick={handleClick}>Button</div>

// Invalid ARIA
<button role="heading">Click</button>
```

### ✅ Do This Instead
```tsx
// With label
<label htmlFor="name">Name</label>
<input id="name" placeholder="e.g. John" />

// Correct tabindex (0 or -1 only)
<div role="button" tabIndex={0} onClick={handleClick}>
  Click me
</div>

// Allow keyboard
<input onKeyDown={handleKeyDown} />

// Use button element
<button onClick={handleClick}>Button</button>

// Valid ARIA
<button>Click</button>
```

## Testing Checklist

### Before Committing
- [ ] Run `npm run test:a11y`
- [ ] Test with keyboard only (no mouse)
- [ ] Check focus visible on all elements
- [ ] Verify all images/icons have labels or aria-hidden
- [ ] Test form validation errors are announced

### Before PR
- [ ] All automated tests pass
- [ ] Manual keyboard testing completed
- [ ] Tested with screen reader (NVDA/JAWS)
- [ ] High contrast mode looks correct
- [ ] Focus order is logical

## Writing Tests

### Basic Template
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

describe('Component Accessibility', () => {
  it('should have no violations', async () => {
    const { container } = render(<Component />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should be keyboard accessible', async () => {
    render(<Component />);
    const user = userEvent.setup();

    const button = screen.getByRole('button');
    await user.tab();

    expect(button).toHaveFocus();
  });
});
```

## Resources

- **Full Guide:** [ACCESSIBILITY_TEST_GUIDE.md](./ACCESSIBILITY_TEST_GUIDE.md)
- **Summary:** [ACCESSIBILITY_TESTS_SUMMARY.md](./ACCESSIBILITY_TESTS_SUMMARY.md)
- **WCAG:** https://www.w3.org/WAI/WCAG21/quickref/
- **ARIA:** https://www.w3.org/WAI/ARIA/apg/

## Help

Questions? Check:
1. This quick reference
2. Existing test files for examples
3. ACCESSIBILITY_TEST_GUIDE.md for detailed info
4. Team accessibility champion
