/**
 * Example Test File for Renderer Process
 * This demonstrates React component testing patterns
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Example component to test
function ExampleButton({ onClick, label }: { onClick?: () => void; label: string }) {
  return (
    <button onClick={onClick} data-testid="example-button">
      {label}
    </button>
  );
}

// Example component with state
function Counter() {
  const [count, setCount] = React.useState(0);

  return (
    <div>
      <p data-testid="count-display">Count: {count}</p>
      <button onClick={() => setCount(count + 1)} data-testid="increment-button">
        Increment
      </button>
      <button onClick={() => setCount(count - 1)} data-testid="decrement-button">
        Decrement
      </button>
    </div>
  );
}

describe('Example Renderer Tests', () => {
  describe('ExampleButton', () => {
    it('should render with label', () => {
      render(<ExampleButton label="Click me" />);

      expect(screen.getByTestId('example-button')).toBeInTheDocument();
      expect(screen.getByText('Click me')).toBeInTheDocument();
    });

    it('should call onClick when clicked', () => {
      const handleClick = jest.fn();
      render(<ExampleButton onClick={handleClick} label="Click me" />);

      fireEvent.click(screen.getByTestId('example-button'));

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should be accessible', () => {
      render(<ExampleButton label="Accessible button" />);

      const button = screen.getByTestId('example-button');
      expect(button).toBeEnabled();
    });
  });

  describe('Counter', () => {
    it('should start at 0', () => {
      render(<Counter />);

      expect(screen.getByTestId('count-display')).toHaveTextContent('Count: 0');
    });

    it('should increment when increment button is clicked', () => {
      render(<Counter />);

      fireEvent.click(screen.getByTestId('increment-button'));

      expect(screen.getByTestId('count-display')).toHaveTextContent('Count: 1');
    });

    it('should decrement when decrement button is clicked', () => {
      render(<Counter />);

      fireEvent.click(screen.getByTestId('decrement-button'));

      expect(screen.getByTestId('count-display')).toHaveTextContent('Count: -1');
    });

    it('should handle multiple clicks', () => {
      render(<Counter />);

      fireEvent.click(screen.getByTestId('increment-button'));
      fireEvent.click(screen.getByTestId('increment-button'));
      fireEvent.click(screen.getByTestId('increment-button'));

      expect(screen.getByTestId('count-display')).toHaveTextContent('Count: 3');
    });
  });

  describe('React hooks', () => {
    it('should handle useEffect', () => {
      function EffectComponent() {
        const [mounted, setMounted] = React.useState(false);

        React.useEffect(() => {
          setMounted(true);
        }, []);

        return <div data-testid="effect-status">{mounted ? 'Mounted' : 'Not mounted'}</div>;
      }

      render(<EffectComponent />);

      expect(screen.getByTestId('effect-status')).toHaveTextContent('Mounted');
    });
  });
});
