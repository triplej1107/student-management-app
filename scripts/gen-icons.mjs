import sharp from "sharp";

const SRC = "public/logo-icon.png";
const BG = "#ffffff";

async function makeIcon(size, outPath, marginRatio = 0.22) {
  const logoSize = Math.round(size * (1 - marginRatio * 2));
  const logo = await sharp(SRC)
    .resize(logoSize, logoSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  const offset = Math.round((size - logoSize) / 2);

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BG,
    },
  })
    .composite([{ input: logo, left: offset, top: offset }])
    .flatten({ background: BG })
    .removeAlpha()
    .png()
    .toFile(outPath);

  console.log(`wrote ${outPath} (${size}x${size})`);
}

await makeIcon(192, "public/icon-192.png");
await makeIcon(512, "public/icon-512.png");
