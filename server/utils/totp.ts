import { authenticator } from 'otplib';

// Configure otplib to follow standard TOTP specifications (RFC 6238)
// This matches GitHub's and PyPI's TOTP implementation
authenticator.options = {
  window: 1,        // Allow 1 step before/after for time drift
  step: 30,         // 30 second time step (standard)
  digits: 6,        // 6 digits (standard)
  algorithm: 'sha1'  // SHA1 algorithm (standard)
};

// Generate a new TOTP secret (automatically uses base32 encoding)
export function generateSecret(): string {
  return authenticator.generateSecret(20); // 20 bytes = 160 bits, standard for TOTP
}

// Generate current TOTP code from a secret
export function generateTOTP(secret: string, timeOffset: number = 0): string {
  try {
    // Clean up the secret by removing spaces and converting to uppercase
    const cleanSecret = secret.replace(/\s+/g, '').toUpperCase();
    // Ensure the secret is properly base32 encoded and use current time
    const encodedSecret = authenticator.encode(cleanSecret);

    // Calculate the time with offset
    const time = Math.floor(Date.now() / 1000) + timeOffset;
    return authenticator.generate(encodedSecret, time);
  } catch (error) {
    // If the secret is already properly encoded, use it directly
    const cleanSecret = secret.replace(/\s+/g, '').toUpperCase();
    // Use current time for generation
    const time = Math.floor(Date.now() / 1000) + timeOffset;
    return authenticator.generate(cleanSecret, time);
  }
}

// Verify a TOTP code
export function verifyTOTP(token: string, secret: string): boolean {
  try {
    // Clean up the secret by removing spaces and converting to uppercase
    const cleanSecret = secret.replace(/\s+/g, '').toUpperCase();
    // Ensure the secret is properly base32 encoded
    return authenticator.verify({ token, secret: authenticator.encode(cleanSecret) });
  } catch (error) {
    // If the secret is already properly encoded, use it directly
    const cleanSecret = secret.replace(/\s+/g, '').toUpperCase();
    return authenticator.verify({ token, secret: cleanSecret });
  }
}

// Generate the otpauth URL for QR codes
export function generateOTPAuthURL(username: string, secret: string, issuer: string = 'AuthService'): string {
  // Clean up and encode the secret
  const cleanSecret = secret.replace(/\s+/g, '').toUpperCase();
  const encodedSecret = authenticator.encode(cleanSecret);
  return authenticator.keyuri(username, issuer, encodedSecret);
}