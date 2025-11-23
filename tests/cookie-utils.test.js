/**
 * Cookie Utilities Test Suite
 * 
 * Tests for URL encoding edge cases and special character handling
 * Run with: node tests/cookie-utils.test.js
 */

const { parseCookies, serializeCookieOptions, createSetCookieHeader } = require('../utils/cookies');

// Simple test runner
let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passedTests++;
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   Error: ${error.message}`);
    failedTests++;
  }
}

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message || 'Assertion failed'}\n   Expected: ${JSON.stringify(expected)}\n   Actual: ${JSON.stringify(actual)}`);
  }
}

function assertTrue(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed: expected true');
  }
}

console.log('\n🧪 Running Cookie Utilities Tests...\n');
console.log('=' + '='.repeat(60) + '\n');

// Test Suite 1: parseCookies()
console.log('📦 parseCookies() Tests:\n');

test('Parse simple cookie', () => {
  const result = parseCookies('token=abc123');
  assertEqual(result, { token: 'abc123' });
});

test('Parse multiple cookies', () => {
  const result = parseCookies('accessToken=token1; refreshToken=token2');
  assertEqual(result, { accessToken: 'token1', refreshToken: 'token2' });
});

test('Parse empty cookie header', () => {
  const result = parseCookies('');
  assertEqual(result, {});
});

test('Parse null cookie header', () => {
  const result = parseCookies(null);
  assertEqual(result, {});
});

test('Parse cookie with spaces in value (URL encoded)', () => {
  const result = parseCookies('message=hello%20world');
  assertEqual(result, { message: 'hello world' });
});

test('Parse cookie with special characters (URL encoded)', () => {
  const result = parseCookies('data=test%40email.com');
  assertEqual(result, { data: 'test@email.com' });
});

test('Parse cookie with equals sign in value', () => {
  const result = parseCookies('jwt=eyJhbGc.eyJzdWI%3D');
  assertEqual(result, { jwt: 'eyJhbGc.eyJzdWI=' });
});

test('Parse cookie with semicolon in encoded value', () => {
  const result = parseCookies('data=value%3Bwith%3Bsemicolons');
  assertEqual(result, { data: 'value;with;semicolons' });
});

test('Parse cookie with comma in encoded value', () => {
  const result = parseCookies('list=item1%2Citem2%2Citem3');
  assertEqual(result, { list: 'item1,item2,item3' });
});

test('Parse cookie with quotes in encoded value', () => {
  const result = parseCookies('text=%22quoted%20text%22');
  assertEqual(result, { text: '"quoted text"' });
});

test('Parse cookie with Unicode characters', () => {
  const result = parseCookies('name=%E2%9C%A8emoji%E2%9C%A8');
  assertEqual(result, { name: '✨emoji✨' });
});

test('Parse cookie with plus sign (should not convert to space)', () => {
  const result = parseCookies('calc=1%2B1');
  assertEqual(result, { calc: '1+1' });
});

test('Parse cookies with trailing semicolon', () => {
  const result = parseCookies('token=abc;');
  assertEqual(result, { token: 'abc' });
});

test('Parse cookies with leading/trailing spaces', () => {
  const result = parseCookies(' token=abc ; key=value ');
  assertEqual(result, { token: 'abc', key: 'value' });
});

test('Ignore malformed cookie (no value)', () => {
  const result = parseCookies('validCookie=value; malformed; anotherValid=test');
  // Should only parse valid cookies
  assertTrue(result.validCookie === 'value' && result.anotherValid === 'test');
});

console.log('\n' + '─'.repeat(60) + '\n');

// Test Suite 2: serializeCookieOptions()
console.log('⚙️  serializeCookieOptions() Tests:\n');

test('Serialize basic options', () => {
  const result = serializeCookieOptions({
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    path: '/'
  });
  assertEqual(result, 'HttpOnly; Secure; SameSite=Strict; Path=/');
});

test('Serialize with maxAge', () => {
  const result = serializeCookieOptions({
    httpOnly: true,
    maxAge: 3600000 // 1 hour in ms
  });
  assertEqual(result, 'HttpOnly; Max-Age=3600');
});

test('Serialize partial options', () => {
  const result = serializeCookieOptions({
    secure: true,
    sameSite: 'Lax'
  });
  assertEqual(result, 'Secure; SameSite=Lax');
});

test('Serialize empty options', () => {
  const result = serializeCookieOptions({});
  assertEqual(result, '');
});

test('Serialize only httpOnly', () => {
  const result = serializeCookieOptions({ httpOnly: true });
  assertEqual(result, 'HttpOnly');
});

test('Serialize with different sameSite values', () => {
  const strict = serializeCookieOptions({ sameSite: 'Strict' });
  const lax = serializeCookieOptions({ sameSite: 'Lax' });
  const none = serializeCookieOptions({ sameSite: 'None' });
  
  assertTrue(strict.includes('SameSite=Strict'));
  assertTrue(lax.includes('SameSite=Lax'));
  assertTrue(none.includes('SameSite=None'));
});

console.log('\n' + '─'.repeat(60) + '\n');

// Test Suite 3: createSetCookieHeader()
console.log('🍪 createSetCookieHeader() Tests:\n');

test('Create basic Set-Cookie header', () => {
  const result = createSetCookieHeader('token', 'abc123', {
    httpOnly: true,
    path: '/'
  });
  assertTrue(result.startsWith('token='));
  assertTrue(result.includes('HttpOnly'));
  assertTrue(result.includes('Path=/'));
});

test('Create header with special characters in value', () => {
  const result = createSetCookieHeader('email', 'test@example.com', {
    path: '/'
  });
  assertTrue(result.includes('test%40example.com'));
});

test('Create header with spaces in value', () => {
  const result = createSetCookieHeader('name', 'John Doe', {
    path: '/'
  });
  assertTrue(result.includes('John%20Doe'));
});

test('Create header with JWT-like token', () => {
  const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature';
  const result = createSetCookieHeader('jwt', jwt, {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict'
  });
  assertTrue(result.includes('jwt='));
  assertTrue(result.includes('HttpOnly'));
  assertTrue(result.includes('Secure'));
});

test('Create header with Unicode emoji', () => {
  const result = createSetCookieHeader('name', '✨Test✨', {
    path: '/'
  });
  // Should be URL encoded
  assertTrue(result.includes('%'));
});

test('Create header with semicolon in value', () => {
  const result = createSetCookieHeader('data', 'value;with;semicolons', {
    path: '/'
  });
  assertTrue(result.includes('%3B')); // URL encoded semicolon
});

test('Create header with equals sign in value', () => {
  const result = createSetCookieHeader('formula', 'a=b+c', {
    path: '/'
  });
  assertTrue(result.includes('%3D')); // URL encoded equals
  assertTrue(result.includes('%2B')); // URL encoded plus
});

test('Create header with comma in value', () => {
  const result = createSetCookieHeader('list', 'a,b,c', {
    path: '/'
  });
  assertTrue(result.includes('%2C')); // URL encoded comma
});

test('Create header with quotes in value', () => {
  const result = createSetCookieHeader('text', '"quoted"', {
    path: '/'
  });
  assertTrue(result.includes('%22')); // URL encoded quote
});

console.log('\n' + '─'.repeat(60) + '\n');

// Test Suite 4: Round-trip encoding/decoding
console.log('🔄 Round-trip Encoding Tests:\n');

test('Round-trip: simple value', () => {
  const original = 'simple-value_123';
  const header = createSetCookieHeader('test', original, { path: '/' });
  const cookies = parseCookies(header.split(';')[0]);
  assertEqual(cookies.test, original);
});

test('Round-trip: email address', () => {
  const original = 'user@example.com';
  const header = createSetCookieHeader('email', original, { path: '/' });
  const cookies = parseCookies(header.split(';')[0]);
  assertEqual(cookies.email, original);
});

test('Round-trip: text with spaces', () => {
  const original = 'hello world test';
  const header = createSetCookieHeader('message', original, { path: '/' });
  const cookies = parseCookies(header.split(';')[0]);
  assertEqual(cookies.message, original);
});

test('Round-trip: special characters', () => {
  const original = 'test!@#$%^&*()';
  const header = createSetCookieHeader('special', original, { path: '/' });
  const cookies = parseCookies(header.split(';')[0]);
  assertEqual(cookies.special, original);
});

test('Round-trip: JWT token', () => {
  // NOTE: This is a DUMMY/EXAMPLE JWT token for testing purposes only
  // Structure: header.payload.signature (standard JWT format)
  // NOT a real secret - used only to test cookie encoding of JWT-like strings
  const original = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
  const header = createSetCookieHeader('jwt', original, { path: '/' });
  const cookies = parseCookies(header.split(';')[0]);
  assertEqual(cookies.jwt, original);
});

test('Round-trip: Unicode characters', () => {
  const original = '你好世界';
  const header = createSetCookieHeader('chinese', original, { path: '/' });
  const cookies = parseCookies(header.split(';')[0]);
  assertEqual(cookies.chinese, original);
});

test('Round-trip: Mixed content', () => {
  const original = 'User: test@email.com (Admin) #2024';
  const header = createSetCookieHeader('info', original, { path: '/' });
  const cookies = parseCookies(header.split(';')[0]);
  assertEqual(cookies.info, original);
});

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 TEST SUMMARY');
console.log('='.repeat(60));
console.log(`Total Tests: ${passedTests + failedTests}`);
console.log(`✅ Passed: ${passedTests}`);
console.log(`❌ Failed: ${failedTests}`);
console.log('='.repeat(60) + '\n');

if (failedTests === 0) {
  console.log('🎉 All tests passed!\n');
  process.exit(0);
} else {
  console.log('⚠️  Some tests failed. Please review.\n');
  process.exit(1);
}
