import { useState, useEffect } from 'react';

/**
 * Custom Hook: useDebounce
 * Trì hoãn cập nhật giá trị trong khoảng delay (ms) nhằm tối ưu hiệu năng và tránh re-fetch liên tục khi gõ phím.
 * 
 * @template T
 * @param {T} value - Giá trị cần debounce
 * @param {number} delay - Thời gian chờ (mặc định 300ms)
 * @returns {T} - Giá trị đã qua debounce
 */
export const useDebounce = (value, delay = 300) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

export default useDebounce;
