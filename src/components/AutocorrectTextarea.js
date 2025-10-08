import React, { useRef, useCallback, forwardRef } from 'react';
import { autocorrectService } from '../services/AutocorrectService';

// A textarea component that applies autocorrect on change
export const AutocorrectTextarea = forwardRef(({ value, onChange, ...props }, externalRef) => {
  const textareaRef = useRef(null);

  const handleChange = useCallback((e) => {
    const textarea = e.target;
    const newValue = textarea.value;
    const cursorPosition = textarea.selectionStart;
    
    // Apply autocorrect without built-in rules (no parentheses escaping for renderings)
    const result = autocorrectService.applyAutocorrect(newValue, cursorPosition, false);
    
    if (result.modified) {
      console.log('AutocorrectTextarea: text was modified by autocorrect');
      // Update cursor position after React re-renders
      setTimeout(() => {
        const targetRef = externalRef || textareaRef;
        if (targetRef && targetRef.current) {
          targetRef.current.setSelectionRange(result.cursorPosition, result.cursorPosition);
        }
      }, 0);
      
      // Call parent onChange with corrected value
      if (onChange) {
        onChange({ target: { value: result.text } });
      }
    } else {
      console.log('AutocorrectTextarea: text not modified, calling parent onChange');
      if (onChange) {
        onChange(e);
      }
    }
  }, [onChange, externalRef]);

  return (
    <textarea
      ref={(el) => {
        // Set both internal and external refs
        textareaRef.current = el;
        if (externalRef) {
          if (typeof externalRef === 'function') {
            externalRef(el);
          } else {
            externalRef.current = el;
          }
        }
      }}
      value={value}
      onChange={handleChange}
      {...props}
    />
  );
});