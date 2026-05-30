const fs = require('fs');
const pdf = require('pdf-parse');

const dataBuffer = fs.readFileSync('C:\\Users\\CyR Las Palmas\\Desktop\\Documents\\Cierre.pdf');

console.log(typeof pdf, Object.keys(pdf));
if (typeof pdf === 'function') {
  pdf(dataBuffer).then(function(data) {
    console.log(data.text);
  }).catch(function(error) {
    console.error("Error reading PDF:", error);
  });
} else if (typeof pdf.default === 'function') {
  pdf.default(dataBuffer).then(function(data) {
    console.log(data.text);
  }).catch(function(error) {
    console.error("Error reading PDF:", error);
  });
}

