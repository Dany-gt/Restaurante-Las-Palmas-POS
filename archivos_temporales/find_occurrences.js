const fs = require('fs');
const content = fs.readFileSync('components/CheckoutView.tsx', 'utf-8');
const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('const total') || line.includes('let total') || line.includes('setTotal')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
