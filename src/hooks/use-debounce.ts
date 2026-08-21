import { useCallback, useEffect, useRef } from "react";

export const useDebounce = <TArgs extends unknown[]>(
  fn: (...args: TArgs) => unknown,
  delay: number = 500,
) => {
  const fnRef = useRef(fn);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const debounce = useCallback(
    (...args: TArgs) => {
      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = setTimeout(() => fnRef.current(...args), delay);
    },
    [delay],
  );

  return debounce;
};
