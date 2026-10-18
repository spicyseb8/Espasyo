import "./FlatLay.css";

// Any aspect ratio works: each image is cropped to fill its board (object-fit: cover).
// Put your files in /public/woods/ or import them and list them here.
const IMAGES = [
  "/textures/text1.jpg",
  "/textures/text2.jpg",
  "/textures/text3.jpg",
  "/textures/text4.jpg",
  "/textures/text5.jpg",
  "/textures/text6.jpg",
  "/textures/text7.jpg",
  "/textures/text8.jpg",
];

// Board sizes in grid cells (cols × rows). Cycled so the layout feels varied.
// Tall boards (2×4) mimic real veneer sheets; the others add rhythm.
const SIZES: Array<[number, number]> = [
  [2, 4],
  [2, 3],
  [2, 4],
  [3, 3],
  [2, 4],
  [2, 3],
];

// Same image can appear again with different crop/rotation for more variety.
const POSITIONS = ["50% 50%", "20% 80%", "80% 20%", "50% 0%"];

export default function FlatLay({ images = IMAGES }: { images?: string[] }) {
  // Repeat the list so the grid always overflows the frame (bleeds off the edges).
  const boards = Array.from({ length: 24 }, (_, i) => ({
    src: images[i % images.length],
    size: SIZES[i % SIZES.length],
    pos: POSITIONS[Math.floor(i / images.length) % POSITIONS.length],
    // Every other lap, turn the image 90° so the grain direction changes.
    turned: Math.floor(i / images.length) % 2 === 1,
  }));

  return (
    <div className="flatlay" aria-hidden="true">
      {/* Shadow lives on this unrotated wrapper, so light direction stays
          the same for every board no matter how the grid is rotated. */}
      <div className="flatlay__shadow">
        <div className="flatlay__grid">
          {boards.map((b, i) => (
            <div
              key={i}
              className="flatlay__board"
              style={{ gridColumn: `span ${b.size[0]}`, gridRow: `span ${b.size[1]}` }}
            >
              <img
                src={b.src}
                alt=""
                loading="lazy"
                className={b.turned ? "is-turned" : undefined}
                style={{ objectPosition: b.pos }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}