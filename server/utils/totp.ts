import { authenticator } from 'otplib';

// Configure otplib
authenticator.options = {
  window: 1,        // Allow 1 step before/after for time drift
  step: 30          // 30 second window for each code
};

// Generate a new TOTP secret
export function generateSecret(): string {
  return authenticator.generateSecret();
}

// Generate current TOTP code from a secret
export function generateTOTP(secret: string): string {
  return authenticator.generate(secret);
}

// Verify a TOTP code
export function verifyTOTP(token: string, secret: string): boolean {
  return authenticator.verify({ token, secret });
}