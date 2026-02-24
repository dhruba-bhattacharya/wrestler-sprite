const imageInput = document.getElementById('imageInput');
const wrestlerInput = document.getElementById('wrestlerInput');
const searchButton = document.getElementById('searchButton');
const statusText = document.getElementById('statusText');
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

function setStatus(message, type = 'muted') {
  statusText.textContent = message;
  statusText.dataset.type = type;
}

function mapDetailToPixelSize(detail, style) {
  if (style === 'faithful') {
    return Math.max(3, Math.round(20 - detail * 0.14));
  }

  return Math.max(5, Math.round(56 - detail * 0.48));
}

function mapDetailToColorLevels(detail, style) {
  if (style === 'faithful') {
    return Math.max(6, Math.round(5 + detail * 0.18));
  }

  return Math.max(3, Math.round(2 + detail * 0.1));
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

function getBlockColor(data, width, sourceHeight, startX, startY, blockSize, mode) {
  if (mode === 'stylized') {
    const idx = ((startY * width) + startX) * 4;
    return [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]];
  }

  let r = 0;
  let g = 0;
  let b = 0;
  let a = 0;
  let count = 0;

  for (let y = startY; y < Math.min(startY + blockSize, sourceHeight); y += 1) {
    for (let x = startX; x < Math.min(startX + blockSize, width); x += 1) {
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
      const [pr, pg, pb, pa] = getBlockColor(data, sourceCanvas.width, sourceCanvas.height, x, y, pixelSize, style);
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
  ctx.fillText('Search a wrestler or upload an image', canvas.width / 2, canvas.height / 2);

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

function imageFromCanvas(localCanvas) {
  const img = new Image();
  img.src = localCanvas.toDataURL('image/png');
  return img;
}

function createUpperBodyImage(img) {
  const cropCanvas = document.createElement('canvas');
  const cropCtx = cropCanvas.getContext('2d');

  const cropWidth = Math.round(img.width * 0.72);
  const cropHeight = Math.round(img.height * 0.68);
  const startX = Math.round((img.width - cropWidth) / 2);
  const startY = Math.round(img.height * 0.08);

  cropCanvas.width = Math.max(1, cropWidth);
  cropCanvas.height = Math.max(1, cropHeight);

  cropCtx.drawImage(
    img,
    clamp(startX, 0, img.width - 1),
    clamp(startY, 0, img.height - 1),
    cropCanvas.width,
    cropCanvas.height,
    0,
    0,
    cropCanvas.width,
    cropCanvas.height,
  );

  const upperBody = imageFromCanvas(cropCanvas);
  upperBody.onload = () => applyImage(upperBody, true);
}

function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load selected image.'));
    img.src = url;
  });
}

async function fetchWrestlerImageUrl(name) {
  const query = encodeURIComponent(`${name} wrestler`);
  const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrsearch=${query}&gsrlimit=8&prop=pageimages|info&piprop=original|thumbnail&pithumbsize=900&inprop=url`;
  const response = await fetch(wikiUrl);

  if (!response.ok) {
    throw new Error('Search request failed.');
  }

  const payload = await response.json();
  const pages = Object.values(payload.query?.pages || {});
  const withImages = pages.filter((page) => page.original?.source || page.thumbnail?.source);

  if (!withImages.length) {
    throw new Error('No wrestler photo found. Try a more specific ring name.');
  }

  const bestMatch = withImages.sort((a, b) => {
    const aSize = (a.thumbnail?.width || 0) + (a.original?.width || 0);
    const bSize = (b.thumbnail?.width || 0) + (b.original?.width || 0);
    return bSize - aSize;
  })[0];

  return bestMatch.original?.source || bestMatch.thumbnail?.source;
}

function loadImageFromFile(file) {
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      createUpperBodyImage(img);
      setStatus('Loaded your uploaded image and built an upper-body sprite reference.', 'ok');
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

async function searchAndBuildSprite() {
  const name = wrestlerInput.value.trim();
  if (!name) {
    setStatus('Type a wrestler name first.', 'error');
    return;
  }

  searchButton.disabled = true;
  setStatus(`Searching the web for ${name}...`, 'muted');

  try {
    const imageUrl = await fetchWrestlerImageUrl(name);
    const image = await loadImageFromUrl(imageUrl);
    createUpperBodyImage(image);
    setStatus(`Built a simplified sprite reference for ${name}.`, 'ok');
  } catch (error) {
    setStatus(error.message || 'Something went wrong while searching.', 'error');
  } finally {
    searchButton.disabled = false;
  }
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

  const mutationRate = clamp(0.08 + (100 - Number(detailSlider.value)) / 190, 0.08, 0.4);

  for (let i = 0; i < data.length; i += 4) {
    if (Math.random() < mutationRate) {
      const shift = Math.round((Math.random() - 0.5) * 60);
      data[i] = clamp(data[i] + shift, 0, 255);
      data[i + 1] = clamp(data[i + 1] + shift, 0, 255);
      data[i + 2] = clamp(data[i + 2] + shift, 0, 255);
    }
  }

  tempCtx.putImageData(imageData, 0, 0);

  const variant = imageFromCanvas(tempCanvas);
  variant.onload = () => applyImage(variant, false);
}

function generateProceduralSprite() {
  const size = 32;
  const randomCanvas = document.createElement('canvas');
  const randomCtx = randomCanvas.getContext('2d');
  randomCanvas.width = size;
  randomCanvas.height = size;

  const palette = ['#0f172a', '#5b647f', '#9ca3af', '#f1c27d', '#c68642', '#1f2937', '#374151', '#e5e7eb'];

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

searchButton.addEventListener('click', searchAndBuildSprite);
wrestlerInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    searchAndBuildSprite();
  }
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
