import React, { useRef, useCallback, forwardRef } from 'react';
import { autocorrectService } from '../services/AutocorrectService';

// A simple input component that applies autocorrect on change
export const AutocorrectInput = forwardRef(({ value, onChange, ...props }, externalRef) => {
  const inputRef = useRef(null);

  const handleChange = useCallback((e) => {
    const input = e.target;
    const newValue = input.value;
    const cursorPosition = input.selectionStart;
    
    // Apply autocorrect with built-in rules (parentheses escaping for vernacular)
    const result = autocorrectService.applyAutocorrect(newValue, cursorPosition, true);
    
    if (result.modified) {
      // Update cursor position after React re-renders
      setTimeout(() => {
        const targetRef = externalRef || inputRef;
        if (targetRef && targetRef.current) {
          targetRef.current.setSelectionRange(result.cursorPosition, result.cursorPosition);
        }
      }, 0);
      
      // Call parent onChange with corrected value
      if (onChange) {
        onChange({ target: { value: result.text } });
      }
    } else {
      if (onChange) {
        onChange(e);
      }
    }
  }, [onChange, externalRef]);

  return (
    <input
      ref={externalRef || inputRef}
      value={value}
      onChange={handleChange}
      {...props}
    />
  );
});
