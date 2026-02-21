const imageInput = document.getElementById('imageInput');
const detailSlider = document.getElementById('detailSlider');
const detailLabel = document.getElementById('detailLabel');
const randomButton = document.getElementById('randomButton');
const saveButton = document.getElementById('saveButton');
const canvas = document.getElementById('spriteCanvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });

const sourceCanvas = document.createElement('canvas');
const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });

let sourceImage = null;

function mapDetailToPixelSize(detail) {
  // 1-100 maps to roughly 48-4 pixel blocks
  return Math.max(4, Math.round(50 - detail * 0.46));
}

function mapDetailToColorLevels(detail) {
  // 1-100 maps to 2-16 color levels per channel
  return Math.max(2, Math.round(2 + detail * 0.14));
}

function quantize(value, levels) {
  const step = 255 / Math.max(1, levels - 1);
  return Math.round(value / step) * step;
}

function fitToCanvas(image, targetWidth, targetHeight) {
  const ratio = Math.min(targetWidth / image.width, targetHeight / image.height);
  const width = Math.max(1, Math.round(image.width * ratio));
  const height = Math.max(1, Math.round(image.height * ratio));
  const x = Math.round((targetWidth - width) / 2);
  const y = Math.round((targetHeight - height) / 2);
  return { x, y, width, height };
}

function renderSprite() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!sourceImage) {
    drawPlaceholder();
    return;
  }

  const detail = Number(detailSlider.value);
  const pixelSize = mapDetailToPixelSize(detail);
  const colorLevels = mapDetailToColorLevels(detail);

  const fit = fitToCanvas(sourceImage, canvas.width, canvas.height);
  sourceCanvas.width = fit.width;
  sourceCanvas.height = fit.height;
  sourceCtx.clearRect(0, 0, sourceCanvas.width, sourceCanvas.height);
  sourceCtx.drawImage(sourceImage, 0, 0, fit.width, fit.height);

  const imageData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const data = imageData.data;

  for (let y = 0; y < sourceCanvas.height; y += pixelSize) {
    for (let x = 0; x < sourceCanvas.width; x += pixelSize) {
      const px = ((y * sourceCanvas.width) + x) * 4;
      const r = quantize(data[px], colorLevels);
      const g = quantize(data[px + 1], colorLevels);
      const b = quantize(data[px + 2], colorLevels);
      const a = data[px + 3] / 255;

      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
      ctx.fillRect(fit.x + x, fit.y + y, pixelSize, pixelSize);
    }
  }

  saveButton.disabled = false;
}

function drawPlaceholder() {
  ctx.fillStyle = '#111422';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#2b3148';
  for (let y = 0; y < canvas.height; y += 16) {
    for (let x = 0; x < canvas.width; x += 16) {
      if ((x + y) % 32 === 0) {
        ctx.fillRect(x, y, 16, 16);
      }
    }
  }

  ctx.fillStyle = '#d5def4';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Upload an image or click Random Sprite', canvas.width / 2, canvas.height / 2);

  saveButton.disabled = true;
}

function loadImageFromFile(file) {
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      sourceImage = img;
      renderSprite();
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function generateRandomSprite() {
  const size = 32;
  const randomCanvas = document.createElement('canvas');
  const randomCtx = randomCanvas.getContext('2d');
  randomCanvas.width = size;
  randomCanvas.height = size;

  const palette = [];

  if (sourceImage) {
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    tempCanvas.width = 24;
    tempCanvas.height = 24;
    tempCtx.drawImage(sourceImage, 0, 0, 24, 24);
    const data = tempCtx.getImageData(0, 0, 24, 24).data;

    for (let i = 0; i < 8; i += 1) {
      const idx = Math.floor(Math.random() * (data.length / 4)) * 4;
      palette.push(`rgb(${data[idx]}, ${data[idx + 1]}, ${data[idx + 2]})`);
    }
  } else {
    for (let i = 0; i < 8; i += 1) {
      const hue = Math.floor(Math.random() * 360);
      const sat = 50 + Math.random() * 40;
      const light = 35 + Math.random() * 30;
      palette.push(`hsl(${hue} ${sat}% ${light}%)`);
    }
  }

  randomCtx.clearRect(0, 0, size, size);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size / 2; x += 1) {
      const color = palette[Math.floor(Math.random() * palette.length)];
      if (Math.random() > 0.2) {
        randomCtx.fillStyle = color;
        randomCtx.fillRect(x, y, 1, 1);
        randomCtx.fillRect(size - x - 1, y, 1, 1);
      }
    }
  }

  const img = new Image();
  img.onload = () => {
    sourceImage = img;
    renderSprite();
  };
  img.src = randomCanvas.toDataURL('image/png');
}

imageInput.addEventListener('change', (event) => {
  const [file] = event.target.files || [];
  loadImageFromFile(file);
});

detailSlider.addEventListener('input', () => {
  detailLabel.textContent = detailSlider.value;
  renderSprite();
});

randomButton.addEventListener('click', generateRandomSprite);

saveButton.addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = `sprite-${Date.now()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
});

drawPlaceholder();
