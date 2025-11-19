// Quick test of the validator
const { execSync } = require('child_process');

try {
  const output = execSync('node validate-collections.js', { 
    encoding: 'utf8',
    stdio: 'pipe',
    timeout: 30000
  });
  console.log(output);
} catch (error) {
  console.log(error.stdout);
  console.error(error.stderr);
  process.exit(error.status || 1);
}
