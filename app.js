const imageInput = document.getElementById('imageInput');
const wrestlerInput = document.getElementById('wrestlerInput');
const searchButton = document.getElementById('searchButton');
const statusText = document.getElementById('statusText');
const detailSlider = document.getElementById('detailSlider');
const detailLabel = document.getElementById('detailLabel');
const randomButton = document.getElementById('randomButton');
const restoreButton = document.getElementById('restoreButton');
const saveButton = document.getElementById('saveButton');
const canvas = document.getElementById('spriteCanvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });

const workCanvas = document.createElement('canvas');
const workCtx = workCanvas.getContext('2d', { willReadFrequently: true });

let sourceImage = null;
let originalImage = null;

const retroPalette = [
  [18, 18, 24],
  [41, 42, 55],
  [74, 79, 97],
  [122, 127, 145],
  [215, 171, 133],
  [189, 138, 101],
  [159, 110, 78],
  [250, 216, 182],
  [44, 30, 22],
  [84, 63, 47],
  [50, 73, 130],
  [74, 108, 184],
  [185, 157, 64],
  [222, 191, 96],
  [238, 239, 243],
  [12, 12, 16],
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function setStatus(message, type = 'muted') {
  statusText.textContent = message;
  statusText.dataset.type = type;
}

function drawPlaceholder() {
  ctx.fillStyle = '#1a1708';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const gradient = ctx.createRadialGradient(128, 100, 20, 128, 120, 160);
  gradient.addColorStop(0, '#6f6b26');
  gradient.addColorStop(1, '#2a270f');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#ece9d2';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Search a wrestler to generate a detailed retro sprite', canvas.width / 2, canvas.height / 2);

  saveButton.disabled = true;
  restoreButton.disabled = true;
}

function nearestPaletteColor(r, g, b) {
  let best = retroPalette[0];
  let bestDist = Number.POSITIVE_INFINITY;

  for (const color of retroPalette) {
    const dr = r - color[0];
    const dg = g - color[1];
    const db = b - color[2];
    const dist = dr * dr + dg * dg + db * db;

    if (dist < bestDist) {
      bestDist = dist;
      best = color;
    }
  }

  return best;
}

function renderDetailedSprite(image) {
  const detail = Number(detailSlider.value);
  const spriteW = clamp(Math.round(30 + detail * 0.25), 44, 56);
  const spriteH = clamp(Math.round(42 + detail * 0.34), 64, 82);

  workCanvas.width = spriteW;
  workCanvas.height = spriteH;

  workCtx.imageSmoothingEnabled = true;

  const srcRatio = image.width / image.height;
  const targetRatio = spriteW / spriteH;

  let sx = 0;
  let sy = 0;
  let sw = image.width;
  let sh = image.height;

  if (srcRatio > targetRatio) {
    sw = image.height * targetRatio;
    sx = (image.width - sw) / 2;
  } else {
    sh = image.width / targetRatio;
    sy = image.height * 0.05;
    if (sy + sh > image.height) {
      sy = image.height - sh;
    }
  }

  workCtx.clearRect(0, 0, spriteW, spriteH);
  workCtx.drawImage(image, sx, sy, sw, sh, 0, 0, spriteW, spriteH);

  const imageData = workCtx.getImageData(0, 0, spriteW, spriteH);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const boostedR = clamp((r - 110) * 1.22 + 110, 0, 255);
    const boostedG = clamp((g - 110) * 1.22 + 110, 0, 255);
    const boostedB = clamp((b - 110) * 1.22 + 110, 0, 255);

    const paletteColor = nearestPaletteColor(boostedR, boostedG, boostedB);
    data[i] = paletteColor[0];
    data[i + 1] = paletteColor[1];
    data[i + 2] = paletteColor[2];
  }

  for (let y = 1; y < spriteH - 1; y += 1) {
    for (let x = 1; x < spriteW - 1; x += 1) {
      const idx = (y * spriteW + x) * 4;
      const left = (y * spriteW + (x - 1)) * 4;
      const right = (y * spriteW + (x + 1)) * 4;
      const top = ((y - 1) * spriteW + x) * 4;
      const bottom = ((y + 1) * spriteW + x) * 4;

      const currentLum = data[idx] * 0.2126 + data[idx + 1] * 0.7152 + data[idx + 2] * 0.0722;
      const neighborLum =
        (data[left] + data[right] + data[top] + data[bottom]) * 0.2126 / 4 +
        (data[left + 1] + data[right + 1] + data[top + 1] + data[bottom + 1]) * 0.7152 / 4 +
        (data[left + 2] + data[right + 2] + data[top + 2] + data[bottom + 2]) * 0.0722 / 4;

      if (Math.abs(currentLum - neighborLum) > 24 && currentLum < neighborLum) {
        data[idx] = Math.max(0, data[idx] - 28);
        data[idx + 1] = Math.max(0, data[idx + 1] - 28);
        data[idx + 2] = Math.max(0, data[idx + 2] - 28);
      }
    }
  }

  workCtx.putImageData(imageData, 0, 0);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;

  const scale = Math.floor(Math.min(canvas.width / spriteW, canvas.height / spriteH));
  const renderW = spriteW * scale;
  const renderH = spriteH * scale;
  const dx = Math.floor((canvas.width - renderW) / 2);
  const dy = Math.floor((canvas.height - renderH) / 2);

  const gradient = ctx.createRadialGradient(canvas.width / 2, canvas.height / 3, 10, canvas.width / 2, canvas.height / 2, canvas.width / 1.7);
  gradient.addColorStop(0, '#7e7724');
  gradient.addColorStop(1, '#29260f');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.drawImage(workCanvas, dx, dy, renderW, renderH);

  saveButton.disabled = false;
  restoreButton.disabled = !originalImage || sourceImage === originalImage;
}

function renderSprite() {
  if (!sourceImage) {
    drawPlaceholder();
    return;
  }

  renderDetailedSprite(sourceImage);
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
      applyImage(img, true);
      setStatus('Loaded your image and rendered it in the detailed retro style.', 'ok');
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
    applyImage(image, true);
    setStatus(`Built a detailed retro sprite for ${name}.`, 'ok');
  } catch (error) {
    setStatus(error.message || 'Something went wrong while searching.', 'error');
  } finally {
    searchButton.disabled = false;
  }
}

function generateSourceBasedVariant() {
  const w = workCanvas.width || 50;
  const h = workCanvas.height || 72;
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = w;
  tempCanvas.height = h;
  const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

  tempCtx.drawImage(originalImage, 0, 0, w, h);
  const imageData = tempCtx.getImageData(0, 0, w, h);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    if (Math.random() < 0.08) {
      const shift = Math.round((Math.random() - 0.5) * 30);
      data[i] = clamp(data[i] + shift, 0, 255);
      data[i + 1] = clamp(data[i + 1] + shift, 0, 255);
      data[i + 2] = clamp(data[i + 2] + shift, 0, 255);
    }
  }

  tempCtx.putImageData(imageData, 0, 0);
  const variant = imageFromCanvas(tempCanvas);
  variant.onload = () => applyImage(variant, false);
}

function generateRandomSprite() {
  if (originalImage) {
    generateSourceBasedVariant();
    return;
  }

  setStatus('Search or upload a wrestler image first.', 'error');
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

randomButton.addEventListener('click', generateRandomSprite);

restoreButton.addEventListener('click', () => {
  if (!originalImage) {
    return;
  }

  applyImage(originalImage, false);
});

saveButton.addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = `wrestler-sprite-${Date.now()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
});

drawPlaceholder();
