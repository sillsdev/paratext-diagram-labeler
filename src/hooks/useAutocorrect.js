import { useState, useCallback, useRef } from 'react';
import { autocorrectService } from '../services/AutocorrectService';

export function useAutocorrect(initialValue = '', onChange) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef(null);

  const handleChange = useCallback((e) => {
    const input = e.target;
    const newValue = input.value;
    const cursorPosition = input.selectionStart;
    
    // Apply autocorrect
    const result = autocorrectService.applyAutocorrect(newValue, cursorPosition);
    
    if (result.modified) {
      // Set the corrected value
      setValue(result.text);
      
      // Update cursor position after React re-renders
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.setSelectionRange(result.cursorPosition, result.cursorPosition);
        }
      }, 0);
      
      // Call parent onChange with corrected value
      if (onChange) {
        onChange({ target: { value: result.text } });
      }
    } else {
      setValue(newValue);
      if (onChange) {
        onChange(e);
      }
    }
  }, [onChange]);

  return {
    value,
    setValue,
    handleChange,
    inputRef
  };
}
