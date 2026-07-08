import React from 'react';

interface AgentSkillSelectorProps {
  type: 'agent' | 'skill';
  value: string;
  onChange: (value: string) => void;
  installedOptions: string[];
  error?: string;
  required?: boolean;
}

export const AgentSkillSelector: React.FC<AgentSkillSelectorProps> = ({
  type,
  value,
  onChange,
  installedOptions,
  error,
  required = false
}) => {
  const label = type === 'agent' ? 'Agent' : 'Skill';
  const isDisabled = installedOptions.length === 0;

  const styles = {
    select: {
      width: '100%',
      padding: '8px 12px',
      fontSize: '14px',
      border: error ? '1px solid #ef4444' : '1px solid #d1d5db',
      borderRadius: '6px',
      backgroundColor: isDisabled ? '#f3f4f6' : 'white',
      color: isDisabled ? '#9ca3af' : '#1f2937',
      cursor: isDisabled ? 'not-allowed' : 'pointer',
      outline: 'none',
      transition: 'border-color 0.2s'
    } as React.CSSProperties,
    selectFocus: {
      borderColor: '#3b82f6'
    } as React.CSSProperties,
    helperText: {
      fontSize: '12px',
      color: '#6b7280',
      marginTop: '4px'
    } as React.CSSProperties
  };

  if (isDisabled) {
    return (
      <>
        <select
          style={styles.select}
          disabled
          title={`No ${type}s installed. Click Create or Import.`}
        >
          <option>No {type}s installed. Click Create or Import.</option>
        </select>
        <div style={styles.helperText}>
          Use the Create or Import buttons below to add {type}s.
        </div>
      </>
    );
  }

  return (
    <select
      style={styles.select}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={(e) => {
        if (!error) {
          e.target.style.borderColor = '#3b82f6';
        }
      }}
      onBlur={(e) => {
        e.target.style.borderColor = error ? '#ef4444' : '#d1d5db';
      }}
      required={required}
      aria-label={`Select ${label}`}
      aria-invalid={!!error}
      aria-describedby={error ? `${type}-error` : undefined}
    >
      <option value="">
        {required ? `Select ${label}...` : 'None'}
      </option>
      {installedOptions.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
};
