import { authenticator } from 'otplib';

// Configure otplib to follow standard TOTP specifications (RFC 6238)
authenticator.options = {
  window: 1,        // Allow 1 step before/after for time drift
  step: 30,         // 30 second time step (standard)
  digits: 6,        // 6 digits (standard)
  algorithm: 'sha1' as const  // SHA1 algorithm (standard)
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

    // Calculate the time with offset (in steps, not seconds)
    const timeStep = 30; // 30-second steps
    const currentStep = Math.floor((Date.now() / 1000) / timeStep);
    const offsetStep = Math.floor(timeOffset / timeStep);
    const time = (currentStep + offsetStep) * timeStep;

    // Generate the code using the cleaned secret
    const code = authenticator.generate(cleanSecret);

    console.log(`Generating TOTP for secret: ${cleanSecret.substring(0, 4)}... with offset step ${offsetStep}. Time step: ${currentStep}, Code: ${code}`);
    return code;
  } catch (error) {
    console.error('Error generating TOTP:', error);
    throw new Error('Invalid secret key format');
  }
}

// Verify a TOTP code
export function verifyTOTP(token: string, secret: string): boolean {
  try {
    // Clean up the secret by removing spaces and converting to uppercase
    const cleanSecret = secret.replace(/\s+/g, '').toUpperCase();
    const isValid = authenticator.verify({ token, secret: cleanSecret });
    console.log(`Verifying TOTP token: ${token} for secret: ${cleanSecret.substring(0, 4)}... Result: ${isValid}`);
    return isValid;
  } catch (error) {
    console.error('Error verifying TOTP:', error);
    return false;
  }
}

// Generate the otpauth URL for QR codes
export function generateOTPAuthURL(username: string, secret: string, issuer: string = 'AuthService'): string {
  // Clean up and encode the secret
  const cleanSecret = secret.replace(/\s+/g, '').toUpperCase();
  return authenticator.keyuri(username, issuer, cleanSecret);
}