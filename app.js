const imageInput = document.getElementById('imageInput');
const styleSelect = document.getElementById('styleSelect');
const detailSlider = document.getElementById('detailSlider');
const detailLabel = document.getElementById('detailLabel');
const randomButton = document.getElementById('randomButton');
const restoreButton = document.getElementById('restoreButton');
const saveButton = document.getElementById('saveButton');
const canvas = document.getElementById('spriteCanvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });

const sourceCanvas = document.createElement('canvas');
const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });

let sourceImage = null;
let originalImage = null;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function mapDetailToPixelSize(detail, style) {
  if (style === 'faithful') {
    return Math.max(2, Math.round(18 - detail * 0.15));
  }

  return Math.max(4, Math.round(50 - detail * 0.46));
}

function mapDetailToColorLevels(detail, style) {
  if (style === 'faithful') {
    return Math.max(6, Math.round(6 + detail * 0.2));
  }

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

function getBlockColor(data, width, startX, startY, blockSize, mode) {
  if (mode === 'stylized') {
    const idx = ((startY * width) + startX) * 4;
    return [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]];
  }

  let r = 0;
  let g = 0;
  let b = 0;
  let a = 0;
  let count = 0;

  for (let y = startY; y < Math.min(startY + blockSize, sourceCanvas.height); y += 1) {
    for (let x = startX; x < Math.min(startX + blockSize, sourceCanvas.width); x += 1) {
      const idx = ((y * width) + x) * 4;
      r += data[idx];
      g += data[idx + 1];
      b += data[idx + 2];
      a += data[idx + 3];
      count += 1;
    }
  }

  return [r / count, g / count, b / count, a / count];
}

function renderSprite() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!sourceImage) {
    drawPlaceholder();
    return;
  }

  const detail = Number(detailSlider.value);
  const style = styleSelect.value;
  const pixelSize = mapDetailToPixelSize(detail, style);
  const colorLevels = mapDetailToColorLevels(detail, style);

  const fit = fitToCanvas(sourceImage, canvas.width, canvas.height);
  sourceCanvas.width = fit.width;
  sourceCanvas.height = fit.height;
  sourceCtx.clearRect(0, 0, sourceCanvas.width, sourceCanvas.height);
  sourceCtx.drawImage(sourceImage, 0, 0, fit.width, fit.height);

  const imageData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const data = imageData.data;

  for (let y = 0; y < sourceCanvas.height; y += pixelSize) {
    for (let x = 0; x < sourceCanvas.width; x += pixelSize) {
      const [pr, pg, pb, pa] = getBlockColor(data, sourceCanvas.width, x, y, pixelSize, style);
      const r = quantize(pr, colorLevels);
      const g = quantize(pg, colorLevels);
      const b = quantize(pb, colorLevels);
      const a = pa / 255;

      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
      ctx.fillRect(fit.x + x, fit.y + y, pixelSize, pixelSize);
    }
  }

  saveButton.disabled = false;
  restoreButton.disabled = !originalImage || sourceImage === originalImage;
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
  ctx.fillText('Upload an image or click Random Variant', canvas.width / 2, canvas.height / 2);

  saveButton.disabled = true;
  restoreButton.disabled = true;
}

function applyImage(img, makeOriginal = false) {
  sourceImage = img;
  if (makeOriginal) {
    originalImage = img;
  }
  renderSprite();
}

function loadImageFromFile(file) {
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      applyImage(img, true);
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function imageFromCanvas(localCanvas) {
  const img = new Image();
  img.src = localCanvas.toDataURL('image/png');
  return img;
}

function generateSourceBasedVariant() {
  const size = 48;
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
  tempCanvas.width = size;
  tempCanvas.height = size;

  tempCtx.drawImage(originalImage, 0, 0, size, size);
  const imageData = tempCtx.getImageData(0, 0, size, size);
  const data = imageData.data;

  const mutationRate = clamp(0.06 + (100 - Number(detailSlider.value)) / 220, 0.06, 0.35);

  for (let i = 0; i < data.length; i += 4) {
    if (Math.random() < mutationRate) {
      const shift = Math.round((Math.random() - 0.5) * 50);
      data[i] = clamp(data[i] + shift, 0, 255);
      data[i + 1] = clamp(data[i + 1] + shift, 0, 255);
      data[i + 2] = clamp(data[i + 2] + shift, 0, 255);
    }
  }

  tempCtx.putImageData(imageData, 0, 0);

  if (Math.random() > 0.5) {
    tempCtx.globalAlpha = 0.1;
    tempCtx.save();
    tempCtx.translate(size, 0);
    tempCtx.scale(-1, 1);
    tempCtx.drawImage(tempCanvas, 0, 0);
    tempCtx.restore();
    tempCtx.globalAlpha = 1;
  }

  const variant = imageFromCanvas(tempCanvas);
  variant.onload = () => applyImage(variant, false);
}

function generateProceduralSprite() {
  const size = 32;
  const randomCanvas = document.createElement('canvas');
  const randomCtx = randomCanvas.getContext('2d');
  randomCanvas.width = size;
  randomCanvas.height = size;

  const palette = [];
  for (let i = 0; i < 8; i += 1) {
    const hue = Math.floor(Math.random() * 360);
    const sat = 50 + Math.random() * 40;
    const light = 35 + Math.random() * 30;
    palette.push(`hsl(${hue} ${sat}% ${light}%)`);
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

  const img = imageFromCanvas(randomCanvas);
  img.onload = () => applyImage(img, true);
}

function generateRandomSprite() {
  if (originalImage) {
    generateSourceBasedVariant();
    return;
  }

  generateProceduralSprite();
}

imageInput.addEventListener('change', (event) => {
  const [file] = event.target.files || [];
  loadImageFromFile(file);
});

detailSlider.addEventListener('input', () => {
  detailLabel.textContent = detailSlider.value;
  renderSprite();
});

styleSelect.addEventListener('change', renderSprite);

randomButton.addEventListener('click', generateRandomSprite);

restoreButton.addEventListener('click', () => {
  if (!originalImage) {
    return;
  }
  applyImage(originalImage, false);
});

saveButton.addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = `sprite-${Date.now()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
});

drawPlaceholder();
