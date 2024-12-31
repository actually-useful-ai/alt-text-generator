const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ICON_SIZES = [16, 32, 48, 64, 128, 256, 512];
const SOURCE_ICON = path.join(__dirname, '../assets/images/icon-512.gif');
const ICONS_DIR = path.join(__dirname, '../build/icons');

async function generateIcons() {
  // Create icons directory if it doesn't exist
  if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
  }

  // Read the source image
  const sourceBuffer = fs.readFileSync(SOURCE_ICON);

  // Convert GIF to PNG for processing
  const pngBuffer = await sharp(sourceBuffer, { animated: false })
    .png()
    .toBuffer();

  // Generate PNG icons for all sizes
  const iconPromises = ICON_SIZES.map(async (size) => {
    const filename = path.join(ICONS_DIR, `${size}x${size}.png`);
    await sharp(pngBuffer)
      .resize(size, size)
      .png()
      .toFile(filename);
    console.log(`Generated ${filename}`);
  });

  // Generate ICO file for Windows
  const icoSizes = [16, 32, 48, 256];
  const icoBuffers = await Promise.all(
    icoSizes.map(size =>
      sharp(pngBuffer)
        .resize(size, size)
        .png()
        .toBuffer()
    )
  );

  // Combine PNG buffers into ICO file
  const icoPath = path.join(ICONS_DIR, 'icon.ico');
  const icoData = Buffer.concat([
    // ICO header
    Buffer.from([
      0, 0,             // Reserved
      1, 0,             // ICO type
      icoSizes.length, 0, // Number of images
    ]),
    // ICO directory
    ...icoSizes.map((size, index) => {
      const buffer = icoBuffers[index];
      return Buffer.from([
        size,           // Width
        size,           // Height
        0,              // Color palette
        0,              // Reserved
        1, 0,           // Color planes
        32, 0,          // Bits per pixel
        ...Buffer.from(new Uint32Array([buffer.length]).buffer), // Size
        ...Buffer.from(new Uint32Array([
          6 + (icoSizes.length * 16) + // Header size
          icoBuffers.slice(0, index).reduce((acc, buf) => acc + buf.length, 0)
        ]).buffer), // Offset
      ]);
    }),
    // Image data
    ...icoBuffers,
  ]);

  fs.writeFileSync(icoPath, icoData);
  console.log(`Generated ${icoPath}`);

  // Generate ICNS file for macOS
  const icnsSizes = {
    '16x16': 'icp4',
    '32x32': 'icp5',
    '64x64': 'icp6',
    '128x128': 'ic07',
    '256x256': 'ic08',
    '512x512': 'ic09',
    '1024x1024': 'ic10',
  };

  const icnsBuffers = await Promise.all(
    Object.entries(icnsSizes).map(async ([size, type]) => {
      const [width] = size.split('x').map(Number);
      const buffer = await sharp(pngBuffer)
        .resize(width, width)
        .png()
        .toBuffer();
      return { type, buffer };
    })
  );

  // Combine PNG buffers into ICNS file
  const icnsPath = path.join(ICONS_DIR, 'icon.icns');
  const icnsData = Buffer.concat([
    Buffer.from('icns', 'ascii'), // Magic word
    Buffer.alloc(4), // File length (will be filled later)
    ...icnsBuffers.map(({ type, buffer }) => {
      const header = Buffer.concat([
        Buffer.from(type, 'ascii'),
        Buffer.from(new Uint32Array([buffer.length + 8]).buffer),
      ]);
      return Buffer.concat([header, buffer]);
    }),
  ]);

  // Write total file length
  icnsData.writeUInt32BE(icnsData.length, 4);
  fs.writeFileSync(icnsPath, icnsData);
  console.log(`Generated ${icnsPath}`);

  // Generate PNG icons for Linux
  await Promise.all(iconPromises);
}

generateIcons().catch(console.error); 