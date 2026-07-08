# Accessibility Testing Guide

Comprehensive guide for running and creating accessibility tests following WCAG 2.1 Level AA standards.

## Table of Contents

1. [Running Tests](#running-tests)
2. [Test Structure](#test-structure)
3. [Manual Testing](#manual-testing)
4. [Keyboard-Only Testing](#keyboard-only-testing)
5. [Screen Reader Testing](#screen-reader-testing)
6. [High Contrast Mode Testing](#high-contrast-mode-testing)
7. [Writing New Tests](#writing-new-tests)
8. [WCAG Guidelines Reference](#wcag-guidelines-reference)

---

## Running Tests

### All Tests

```bash
npm test
```

### Accessibility Tests Only

```bash
npm run test:a11y
```

### Watch Mode (Re-run on changes)

```bash
npm run test:watch
```

### With Coverage Report

```bash
npm run test:coverage
```

### Verbose Output

```bash
npm run test:verbose
```

---

## Test Structure

### Automated Accessibility Tests (jest-axe)

Our accessibility tests use `jest-axe` to automatically detect WCAG violations:

```typescript
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

it('should have no accessibility violations', async () => {
  const { container } = render(<Component />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### Test Categories

1. **Automated Tests** - jest-axe scans for violations
2. **ARIA Attributes** - Verify proper roles, states, and properties
3. **Keyboard Navigation** - Test arrow keys, Tab, Enter, Esc
4. **Focus Management** - Test focus trapping, auto-focus, focus order
5. **Screen Reader Support** - Test labels, announcements, descriptions

---

## Manual Testing

Automated tests catch ~50% of accessibility issues. Manual testing is essential.

### Basic Manual Checklist

#### 1. Keyboard Navigation

- [ ] Tab through all interactive elements in order
- [ ] Shift+Tab navigates backwards
- [ ] No keyboard traps (can always escape)
- [ ] Focus visible on all elements
- [ ] Arrow keys work where applicable (trees, tabs)
- [ ] Enter/Space activate buttons and links
- [ ] Esc closes dialogs and dropdowns

#### 2. Visual Inspection

- [ ] Focus indicator is clearly visible (3:1 contrast ratio)
- [ ] Text meets contrast requirements (4.5:1 for normal, 3:1 for large)
- [ ] UI doesn't rely solely on color to convey meaning
- [ ] Touch targets are at least 44x44 pixels
- [ ] Text can be resized to 200% without loss of functionality

#### 3. Content

- [ ] All images have alt text (or aria-label)
- [ ] All form fields have labels
- [ ] Error messages are clear and helpful
- [ ] Instructions don't rely on sensory characteristics ("click the round button")

---

## Keyboard-Only Testing

Test the entire application using only the keyboard.

### Testing Procedure

1. **Unplug your mouse** (or put it out of reach)
2. **Navigate using only keyboard:**
   - `Tab` - Move forward
   - `Shift+Tab` - Move backward
   - `Enter` - Activate buttons/links
   - `Space` - Toggle checkboxes, activate buttons
   - `Arrow Keys` - Navigate within components (tabs, trees, etc.)
   - `Esc` - Close dialogs/menus
   - `Home/End` - Jump to start/end (where applicable)

### NodeConfigDialog Keyboard Testing

```
1. Open dialog → Tab to first field (should auto-focus name input)
2. Tab through all tabs (should skip disabled tabs)
3. Arrow keys navigate between tabs
4. Tab moves into tab content
5. Tab through all form fields
6. Shift+Tab moves backward
7. Esc closes dialog
8. Ctrl+Enter saves
9. Enter submits form (if on submit button)
```

### VariableBrowser Keyboard Testing

```
1. Focus on search input
2. Tab to tree
3. Arrow Down/Up to navigate items
4. Arrow Right to expand
5. Arrow Left to collapse
6. Enter to select/insert variable
7. Tab to next control
```

### Expected Behaviors

- **Focus visible** - Always know where you are
- **Focus order** - Logical top-to-bottom, left-to-right
- **No traps** - Can always escape with Tab/Shift+Tab/Esc
- **Shortcuts work** - All mouse actions have keyboard equivalent

---

## Screen Reader Testing

### Recommended Screen Readers

- **Windows:** NVDA (free, open source)
- **Windows:** JAWS (commercial, widely used)
- **macOS:** VoiceOver (built-in)
- **Linux:** Orca (free, open source)

### NVDA Installation and Setup

1. **Download NVDA:**
   - Visit https://www.nvaccess.org/download/
   - Download latest stable version
   - Install (no admin rights required for portable version)

2. **Basic NVDA Commands:**
   - `Ctrl` - Stop speaking
   - `Insert+Down Arrow` - Read current line
   - `Insert+Up Arrow` - Read from top
   - `Insert+F7` - List all links/headings/form fields
   - `Tab` - Next focusable element (reads it aloud)
   - `Insert+Q` - Quit NVDA

3. **NVDA with Browsers:**
   - Use Chrome or Firefox (best support)
   - Forms mode activates automatically on form fields
   - Browse mode for reading content

### Screen Reader Testing Checklist

#### General

- [ ] All text is read aloud correctly
- [ ] Reading order is logical
- [ ] No unexpected content is read
- [ ] Decorative images are ignored (aria-hidden="true")

#### Interactive Elements

- [ ] Buttons announce their label and role ("Save, button")
- [ ] Links announce their purpose ("Configure Node, link")
- [ ] Form fields announce label, type, and value
- [ ] Required fields announce "required"
- [ ] Invalid fields announce "invalid" and error message

#### Dialogs and Modals

- [ ] Dialog role announced ("dialog" or "alertdialog")
- [ ] Dialog title is read
- [ ] Focus moves into dialog
- [ ] Focus trapped within dialog
- [ ] Closing dialog returns focus

#### Dynamic Content

- [ ] Errors announced immediately (aria-live="assertive")
- [ ] Status updates announced politely (aria-live="polite")
- [ ] Loading states announced
- [ ] Content changes announced

### Testing NodeConfigDialog with NVDA

1. **Open dialog:**
   - Should announce: "Configure Node, dialog"
   - Should read dialog description

2. **Navigate tabs:**
   - Should announce: "Basic Info, tab, selected"
   - Arrow keys should announce each tab

3. **Form fields:**
   - Should announce: "Node Name, edit, required"
   - Typing should echo characters

4. **Error states:**
   - Should announce: "Node name is required, alert"
   - Field should announce "invalid"

5. **Save button:**
   - Should announce: "Save changes and close dialog, button"

### Testing VariableBrowser with NVDA

1. **Search input:**
   - Should announce: "Search variables, edit"

2. **Tree structure:**
   - Should announce: "Available variables, tree"
   - Items should announce: "Market Research, collapsed, tree item"

3. **Expanding items:**
   - Should announce: "Market Research, expanded, tree item"
   - Child items should announce level/depth

4. **Selecting items:**
   - Should announce: "Inserted variable: $.node1.output"

---

## High Contrast Mode Testing

Test with Windows High Contrast Mode or similar.

### Windows High Contrast Mode

1. **Enable:**
   - Press `Left Alt + Left Shift + Print Screen`
   - Or: Settings → Ease of Access → High contrast → Turn on

2. **Test checklist:**
   - [ ] All text is readable
   - [ ] All borders/outlines are visible
   - [ ] Focus indicator is visible
   - [ ] Icons are distinguishable
   - [ ] Hover states are visible
   - [ ] Disabled states are distinguishable

3. **Common issues:**
   - Background images disappear
   - Custom colors ignored
   - Borders need explicit CSS
   - SVGs may not display correctly

### CSS for High Contrast Support

Our components support high contrast mode:

```typescript
if (window.matchMedia?.('(prefers-contrast: high)').matches) {
  // Apply high contrast styles
}
```

Test both:
- High Contrast #1 (Black background)
- High Contrast #2 (White background)

---

## Writing New Tests

### Template for Component Accessibility Tests

```typescript
/**
 * MyComponent Accessibility Tests
 *
 * Tests for WCAG 2.1 Level AA compliance
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { MyComponent } from '../MyComponent';

expect.extend(toHaveNoViolations);

describe('MyComponent - Automated Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<MyComponent />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('MyComponent - ARIA Attributes', () => {
  it('should have proper role', () => {
    render(<MyComponent />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should have accessible label', () => {
    render(<MyComponent />);
    const button = screen.getByRole('button');
    expect(button).toHaveAccessibleName();
  });
});

describe('MyComponent - Keyboard Navigation', () => {
  it('should be keyboard accessible', async () => {
    render(<MyComponent />);
    const user = userEvent.setup();

    const button = screen.getByRole('button');
    button.focus();

    await user.keyboard('{Enter}');
    // Assert expected behavior
  });
});

describe('MyComponent - Screen Reader Support', () => {
  it('should announce changes', async () => {
    render(<MyComponent />);
    // Test aria-live regions, role="alert", etc.
  });
});
```

### Best Practices

1. **Test actual HTML, not implementation details**
   - Use `getByRole`, `getByLabelText`
   - Don't use `getByTestId` unless necessary

2. **Test keyboard interactions**
   - Tab, Arrow keys, Enter, Space, Esc
   - Focus management and trapping

3. **Test ARIA attributes**
   - Roles, states, properties
   - aria-label, aria-labelledby, aria-describedby

4. **Test error states**
   - aria-invalid
   - aria-errormessage or role="alert"

5. **Test dynamic content**
   - aria-live regions
   - Focus management on updates

---

## WCAG Guidelines Reference

### Level A (Must Have)

- **1.1.1** Non-text Content - All images have alt text
- **1.3.1** Info and Relationships - Use semantic HTML
- **2.1.1** Keyboard - All functionality available via keyboard
- **2.4.1** Bypass Blocks - Skip to main content link
- **3.3.2** Labels or Instructions - All inputs have labels

### Level AA (Should Have)

- **1.4.3** Contrast (Minimum) - 4.5:1 for normal text, 3:1 for large
- **1.4.5** Images of Text - Use real text, not images
- **2.4.6** Headings and Labels - Descriptive headings
- **2.4.7** Focus Visible - Keyboard focus indicator visible
- **3.2.4** Consistent Identification - Icons/buttons consistent

### Common ARIA Patterns We Use

#### Tabs

```html
<div role="tablist" aria-label="Configuration tabs">
  <button role="tab" aria-selected="true" aria-controls="panel-1">
    Tab 1
  </button>
  <div role="tabpanel" id="panel-1" aria-labelledby="tab-1">
    Content
  </div>
</div>
```

#### Tree

```html
<div role="tree" aria-label="Available variables">
  <div role="treeitem" aria-expanded="false" aria-label="Node 1">
    <div role="group">
      <div role="treeitem">Child 1</div>
    </div>
  </div>
</div>
```

#### Dialog

```html
<div role="dialog" aria-modal="true" aria-labelledby="title">
  <h2 id="title">Dialog Title</h2>
  <div aria-describedby="description">
    <p id="description">Dialog description</p>
  </div>
</div>
```

#### Form Validation

```html
<label for="email">Email *</label>
<input
  id="email"
  type="email"
  aria-required="true"
  aria-invalid="true"
  aria-describedby="email-error"
/>
<div id="email-error" role="alert">
  Please enter a valid email address
</div>
```

---

## Continuous Testing

### In Development

1. Run tests in watch mode: `npm run test:watch`
2. Test with keyboard-only periodically
3. Use browser DevTools accessibility inspector
4. Run Lighthouse accessibility audits

### In Code Review

1. All new components must have accessibility tests
2. Run full test suite: `npm test`
3. Manual keyboard testing of new features
4. Check for ARIA attributes in code

### Before Release

1. Full accessibility test suite passes
2. Manual testing with NVDA/JAWS
3. Keyboard-only testing of all workflows
4. High contrast mode testing
5. Lighthouse accessibility score > 90

---

## Resources

### Tools

- **jest-axe** - Automated accessibility testing
- **@testing-library/react** - Testing library focused on accessibility
- **axe DevTools** - Browser extension for accessibility testing
- **NVDA** - Free screen reader for Windows
- **Lighthouse** - Built into Chrome DevTools

### Documentation

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [WebAIM Articles](https://webaim.org/articles/)

### Training

- [Web Accessibility by Google (Udacity)](https://www.udacity.com/course/web-accessibility--ud891)
- [Microsoft Learn: Accessibility Fundamentals](https://learn.microsoft.com/en-us/training/paths/accessibility-fundamentals/)
- [Deque University](https://www.deque.com/axe/devtools/)

---

## Troubleshooting

### Tests Failing

**Problem:** jest-axe reports violations

**Solution:**
1. Read the violation details carefully
2. Check the specific WCAG guideline mentioned
3. Fix the HTML/ARIA attributes
4. Re-run tests

**Problem:** Keyboard navigation tests fail

**Solution:**
1. Check focus management code
2. Verify tabindex values (0 for focusable, -1 for not)
3. Test manually with keyboard
4. Check for focus traps

**Problem:** ARIA attribute tests fail

**Solution:**
1. Verify role, aria-label, aria-labelledby
2. Check aria-describedby associations
3. Ensure IDs are unique
4. Validate ARIA relationships

### Common Mistakes

1. **Missing labels** - All form inputs need labels
2. **Wrong roles** - Use semantic HTML first, ARIA second
3. **Focus not visible** - Always show focus indicator
4. **Keyboard traps** - Always provide escape route
5. **Missing error messages** - Errors must be programmatically associated
6. **Decorative icons not hidden** - Use aria-hidden="true"
7. **Invalid ARIA** - Check ARIA roles/attributes are valid

---

## Contact

For accessibility questions or issues:
- Review this guide
- Check WCAG 2.1 documentation
- Run automated tests
- Test manually with screen readers
- Ask team accessibility champions

**Remember:** Accessibility is not optional. It's a core requirement for all new features.
