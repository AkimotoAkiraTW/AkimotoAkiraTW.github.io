/** Signal Forms `Field` path（可呼叫取得 FieldState） */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type UiFormFieldPath = any;

export const UI_FIELD_APPEARANCE = 'outline' as const;
export const UI_FIELD_FLOAT_LABEL = 'always' as const;

function fieldState(path: UiFormFieldPath | null | undefined) {
  if (!path || typeof path !== 'function') return null;
  try {
    return path();
  } catch {
    return null;
  }
}

export function uiFieldHasError(path: UiFormFieldPath | null | undefined): boolean {
  const state = fieldState(path);
  if (!state) return false;
  return state.touched() && state.errors().length > 0;
}

export function uiFieldFirstError(
  path: UiFormFieldPath | null | undefined,
  fallback = '此欄位有誤',
): string | null {
  const state = fieldState(path);
  if (!state?.touched?.() || !state.errors?.()?.length) return null;
  return state.errors()[0].message || fallback;
}
