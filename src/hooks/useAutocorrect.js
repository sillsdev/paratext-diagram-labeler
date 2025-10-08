import { useState, useCallback, useRef, useEffect } from 'react';
import { autocorrectService } from '../services/AutocorrectService';

export function useAutocorrect(initialValue = '', onChange) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef(null);
  const prevInitialValueRef = useRef(initialValue);

  // Sync internal state when external initialValue changes
  useEffect(() => {
    if (initialValue !== prevInitialValueRef.current) {
      // console.log('useAutocorrect: syncing value from', prevInitialValueRef.current, 'to', initialValue);
      setValue(initialValue);
      prevInitialValueRef.current = initialValue;
    }
  }, [initialValue]);

  const handleChange = useCallback((e) => {
    const input = e.target;
    const newValue = input.value;
    const cursorPosition = input.selectionStart;
    
    // console.log('useAutocorrect: handleChange called with value:', newValue, 'current state:', value);
    
    // Apply autocorrect with built-in rules (parentheses escaping for vernacular)
    const result = autocorrectService.applyAutocorrect(newValue, cursorPosition, true);
    
    if (result.modified) {
      // Set the corrected value
      // console.log('useAutocorrect: setting corrected value:', result.text);
      setValue(result.text);
      
      // Update cursor position after React re-renders
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.setSelectionRange(result.cursorPosition, result.cursorPosition);
        }
      }, 0);
      
      // Call parent onChange with corrected value
      if (onChange) {
        // console.log('useAutocorrect: calling parent onChange with corrected value:', result.text);
        onChange(result.text);
      }
    } else {
      // console.log('useAutocorrect: setting original value:', newValue);
      setValue(newValue);
      if (onChange) {
        // console.log('useAutocorrect: calling parent onChange with original value:', newValue);
        onChange(newValue);
      }
    }
  }, [onChange]);

  return {
    value,
    setValue,
    handleChange,
    textareaRef: inputRef
  };
}
