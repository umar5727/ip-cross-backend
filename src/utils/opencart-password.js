const crypto = require('crypto');

/**
 * OpenCart Password Hashing Utility
 * This creates the exact same password format as OpenCart
 */

/**
 * Generate a random salt (9 characters)
 */
function generateSalt() {
  return crypto.randomBytes(9).toString('hex').substring(0, 9);
}

/**
 * Hash password using OpenCart's method
 * @param {string} password - Plain text password
 * @param {string} salt - Salt (optional, will generate if not provided)
 * @returns {object} - { password: hashedPassword, salt: salt }
 */
function hashPassword(password, salt = null) {
  if (!salt) {
    salt = generateSalt();
  }
  
  const hash1 = crypto.createHash('sha1').update(password).digest('hex');
  const hash2 = crypto.createHash('sha1').update(salt + hash1).digest('hex');
  const finalHash = crypto.createHash('sha1').update(salt + hash2).digest('hex');
  
  return {
    password: finalHash,
    salt: salt
  };
}

/**
 * Verify password using OpenCart's method
 * @param {string} candidatePassword - Password to verify
 * @param {string} storedPassword - Stored hashed password
 * @param {string} salt - Stored salt
 * @returns {boolean} - True if password matches
 */
function verifyPassword(candidatePassword, storedPassword, salt) {
  if (salt) {
    // OpenCart SHA1 method with salt
    const hash1 = crypto.createHash('sha1').update(candidatePassword).digest('hex');
    const hash2 = crypto.createHash('sha1').update(salt + hash1).digest('hex');
    const finalHash = crypto.createHash('sha1').update(salt + hash2).digest('hex');
    return storedPassword === finalHash;
  } else {
    // Fallback to MD5 (OpenCart's alternative method)
    const md5Hash = crypto.createHash('md5').update(candidatePassword).digest('hex');
    return storedPassword === md5Hash;
  }
}

/**
 * Test function to verify OpenCart password hashing
 */
function testOpenCartPassword() {
  const testPassword = 'testpass123';
  const result = hashPassword(testPassword);
  
  console.log('OpenCart Password Test:');
  console.log('Original Password:', testPassword);
  console.log('Generated Salt:', result.salt);
  console.log('Hashed Password:', result.password);
  console.log('Password Length:', result.password.length);
  console.log('Salt Length:', result.salt.length);
  
  // Test verification
  const isValid = verifyPassword(testPassword, result.password, result.salt);
  console.log('Verification Test:', isValid ? 'PASS' : 'FAIL');
  
  return result;
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateSalt,
  testOpenCartPassword
};

