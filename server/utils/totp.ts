import { authenticator } from 'otplib';

// Configure otplib to match Google Authenticator's specifications
authenticator.options = {
  window: [1, 0], // Allow one step back for time drift
  step: 30,      // 30-second time window (Google Auth default)
  digits: 6,     // 6-digit codes (Google Auth default)
  encoding: 'hex' // Use hex encoding internally
};

// Generate a new TOTP secret in Google Auth format
export function generateSecret(): string {
  return authenticator.generateSecret(); // Generates a proper base32 secret
}

// Generate current TOTP code from a secret
export function generateTOTP(secret: string, timeOffset: number = 0): string {
  try {
    // Clean up the secret by removing spaces and converting to uppercase
    const cleanSecret = secret.replace(/\s+/g, '').toUpperCase();

    // Calculate the time with offset
    const time = Math.floor(Date.now() / 1000) + timeOffset;
    console.log(`Generating TOTP for secret: ${cleanSecret.slice(0, 4)}... with offset step ${timeOffset}. Time step: ${time}`);

    return authenticator.generate(cleanSecret);
  } catch (error) {
    console.error('Error generating TOTP:', error);
    return '000000'; // Return a clearly invalid code
  }
}

// Verify a TOTP code
export function verifyTOTP(token: string, secret: string): boolean {
  try {
    const cleanSecret = secret.replace(/\s+/g, '').toUpperCase();
    return authenticator.check(token, cleanSecret);
  } catch (error) {
    console.error('Error verifying TOTP:', error);
    return false;
  }
}

// Generate the otpauth URL for QR codes (Google Auth format)
export function generateOTPAuthURL(username: string, secret: string, issuer: string = 'AuthService'): string {
  const cleanSecret = secret.replace(/\s+/g, '').toUpperCase();
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(username)}?secret=${cleanSecret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}