/** Normalize Russian phone input without silently truncating an invalid number. */
export function normalizePhone(input: string): string {
  const value = input.trim();
  if (!/^[+\d\s().-]+$/.test(value) || (value.includes('+') && !value.startsWith('+')) || (value.match(/\+/g)?.length || 0) > 1) {
    throw new Error('Введите российский номер телефона: +7 и 10 цифр');
  }
  const digits = value.replace(/\D/g, '');
  const national = !value.startsWith('+') && digits.length === 10
    ? digits
    : digits.length === 11 && (digits.startsWith('7') || (!value.startsWith('+') && digits.startsWith('8')))
      ? digits.slice(1)
      : '';
  if (!/^[3489]\d{9}$/.test(national)) throw new Error('Введите российский номер телефона: +7 и 10 цифр');
  return '+7' + national;
}

export function normalizeOtp(input: string, length: number): string {
  const code = input.replace(/\s/g, '');
  if (!Number.isSafeInteger(length) || length < 4 || length > 8 || !new RegExp(`^\\d{${length}}$`).test(code)) {
    throw new Error(`Введите код из ${length} цифр`);
  }
  return code;
}
