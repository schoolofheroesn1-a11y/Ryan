export type ActionState = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string | undefined>;
  /** Значения полей, чтобы форма не очищалась после ошибки. */
  values?: Record<string, string | string[]>;
};

export const initialActionState: ActionState = {};
