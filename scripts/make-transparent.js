const { Jimp } = require('jimp');

async function processImage() {
  try {
    const image = await Jimp.read('build/icon.png');
    const w = image.bitmap.width;
    const h = image.bitmap.height;
    const radius = Math.min(w, h) / 2;
    const cx = w / 2;
    const cy = h / 2;

    image.scan(0, 0, w, h, function (x, y, idx) {
      const dx = x - cx + 0.5;
      const dy = y - cy + 0.5;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // We apply a slight anti-aliasing for the edge
      if (distance > radius) {
          this.bitmap.data[idx + 3] = 0; // transparent
      } else if (distance > radius - 2) {
          // Soft edge blending
          const alpha = Math.max(0, Math.min(255, 255 * (radius - distance) / 2));
          // Multiply current alpha by our calculated alpha ratio
          const currentAlpha = this.bitmap.data[idx + 3];
          this.bitmap.data[idx + 3] = Math.floor(currentAlpha * (alpha / 255));
      }
    });

    await image.write('build/icon-transparent.png');
    console.log('Successfully created build/icon-transparent.png');
  } catch (err) {
    console.error('Error processing image:', err);
  }
}

processImage();
