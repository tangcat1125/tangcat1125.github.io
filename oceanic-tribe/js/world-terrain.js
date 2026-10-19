// ============================================================================
// 東海岸五帶體素地形、星空夜景與三仙台舊石器陸連島 (World Terrain & Tombolo)
// ============================================================================

const BLOCK_BY_ID = {};
BLOCK_DEFS.forEach(b => { BLOCK_BY_ID[b.id] = b; });

function hash2D(x, z) {
  let n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function smoothNoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = zf * zf * (3 - 2 * zf);
  const a = hash2D(xi, zi), b = hash2D(xi + 1, zi);
  const c = hash2D(xi, zi + 1), d = hash2D(xi + 1, zi + 1);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

function fbm(x, z, octaves = 3) {
  let val = 0, amp = 0.5, freq = 1;
  for (let i = 0; i < octaves; i++) {
    val += amp * smoothNoise(x * freq, z * freq);
    freq *= 2.02;
    amp *= 0.5;
  }
  return val;
}

const blockCanvases = {};
const blockMaterials = {};

function createVoxelTextureCanvas(def) {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');

  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const r = hash2D(x * 3.7 + def.id * 13, y * 5.3 + def.id * 29);
      let color = def.baseColor;

      if (def.pattern === 'strata') {
        const layer = (y + Math.floor(Math.sin(x * 0.5) * 1.5)) % 4;
        color = def.noiseColors[layer % def.noiseColors.length];
      } else if (def.pattern === 'cobble') {
        const cx = (x % 4) - 1.5;
        const cy = (y % 4) - 1.5;
        if (cx * cx + cy * cy > 3.1) {
          color = '#1e2228';
        } else {
          const pebbleIdx = Math.floor(hash2D(Math.floor(x / 4) * 3, Math.floor(y / 4) * 7) * def.noiseColors.length);
          color = def.noiseColors[pebbleIdx];
        }
      } else if (def.pattern === 'bark') {
        const stripe = (x + Math.floor(r * 2)) % 3;
        color = def.noiseColors[stripe % def.noiseColors.length];
      } else if (def.pattern === 'carved') {
        if ((x === 3 || x === 12) && y > 2 && y < 13) color = '#4a453e';
        else if ((y === 4 || y === 11) && x > 3 && x < 12) color = '#4a453e';
        else if (r > 0.45) color = def.noiseColors[Math.floor(r * def.noiseColors.length)];
      } else if (r > 0.35) {
        color = def.noiseColors[Math.floor(r * def.noiseColors.length)];
      }

      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);

      if (x === 0 || y === 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.fillRect(x, y, 1, 1);
      } else if (x === 15 || y === 15) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  return canvas;
}

function initBlockMaterials() {
  BLOCK_DEFS.forEach(def => {
    const canvas = createVoxelTextureCanvas(def);
    blockCanvases[def.id] = canvas;
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    blockMaterials[def.id] = new THREE.MeshLambertMaterial({ map: tex });
  });
}

// =========================================================================
// 豐濱 ➔ 成功 五大地形帶與三仙台舊石器陸連島生成
// =========================================================================
const WORLD_MIN_X = -46;
const WORLD_MAX_X = 46;
const WORLD_MIN_Z = -32;
const WORLD_MAX_Z = 32;
const WORLD_MIN_Y = -16;
const WORLD_MAX_Y = 30;

const voxelMap = new Map();
const surfaceHeightMap = new Map();

function getVoxelKey(x, y, z) { return `${x},${y},${z}`; }
function setVoxel(x, y, z, id) {
  if (x < WORLD_MIN_X || x > WORLD_MAX_X || z < WORLD_MIN_Z || z > WORLD_MAX_Z || y < WORLD_MIN_Y || y > WORLD_MAX_Y) return;
  voxelMap.set(getVoxelKey(x, y, z), id);
}
function removeVoxel(x, y, z) { voxelMap.delete(getVoxelKey(x, y, z)); }
function getVoxel(x, y, z) { return voxelMap.get(getVoxelKey(x, y, z)) || 0; }
function getSurfaceY(x, z) {
  const rx = Math.max(WORLD_MIN_X, Math.min(WORLD_MAX_X, Math.round(x)));
  const rz = Math.max(WORLD_MIN_Z, Math.min(WORLD_MAX_Z, Math.round(z)));
  return surfaceHeightMap.get(`${rx},${rz}`) ?? 0;
}

function getZoneInfoByX(x) {
  if (x < -21) return { code: 'MOUNTAIN', name: '海岸山脈 (Coastal Range)', badge: '海岸山脈' };
  if (x < -7)  return { code: 'TERRACE',  name: '海階地形 (Marine Terraces)', badge: '海階地形' };
  if (x < 3)   return { code: 'SHORE',    name: '岩岸礫灘與海蝕崖 (Rocky Shore & Cobble Beach)', badge: '岩岸礫灘' };
  if (x < 19)  return { code: 'INTERTIDAL', name: '潮間帶與陸連島礁台 (Intertidal & Tombolo)', badge: '潮間帶・陸連島' };
  return { code: 'SHELF', name: '狹窄大陸棚與黑潮深海斜坡 (Continental Shelf & Kuroshio)', badge: '大陸棚與黑潮' };
}

function generateEastCoastWorld() {
  voxelMap.clear();
  surfaceHeightMap.clear();

  for (let z = WORLD_MIN_Z; z <= WORLD_MAX_Z; z++) {
    const bayCurveX = Math.sin(z * 0.085) * 2.2;

    for (let x = WORLD_MIN_X; x <= WORLD_MAX_X; x++) {
      const effX = x - bayCurveX;
      const n1 = fbm((x + 50) * 0.06, (z + 50) * 0.06, 3);
      const n2 = fbm((x + 120) * 0.14, (z + 120) * 0.14, 2);

      let surfaceY = 0;
      let topBlock = 1;
      let subBlock = 1;

      // 0. 八仙洞開放式階梯聚落劇場與上層山林狩獵大平台 (Z = -3 .. +10, X = -22 .. -7)
      if (z >= -3 && z <= 10 && x >= -22 && x <= -7) {
        if (x <= -14) {
          surfaceY = 11;
          topBlock = (x === -14) ? 1 : 3;
          subBlock = 1;
        } else {
          surfaceY = 5;
          topBlock = (z >= 2 && z <= 7 && x <= -9) ? 1 : 3;
          subBlock = 4;
        }
      }
      // 1. 海岸山脈 (X < -21)
      else if (effX < -21) {
        const t = (-21 - effX) / 25;
        let mountainH = 9 + Math.pow(t, 1.15) * 16 + (n1 - 0.5) * 7 + (n2 - 0.5) * 3;
        const gorgeDist = Math.abs(z - (-8 + Math.sin(x * 0.12) * 3));
        if (gorgeDist < 5.5) {
          const gorgeFactor = Math.max(0, 1 - gorgeDist / 5.5);
          mountainH = mountainH * (1 - gorgeFactor * 0.85) - gorgeFactor * 2;
        }
        surfaceY = Math.round(mountainH);
        if (surfaceY <= 1) { topBlock = 5; subBlock = 1; }
        else if (surfaceY > 18 && n2 > 0.58) { topBlock = 1; subBlock = 1; }
        else { topBlock = 11; subBlock = 1; }
      }
      // 2. 海階地形 (X = -21 .. -7)
      else if (effX < -7) {
        let terraceH = effX < -14 ? 7 : 4;
        if (z >= 11 && z <= 14 && effX < -12) {
          terraceH = 10 + Math.floor(n2 * 2);
        }
        if (n1 > 0.72) terraceH += 1;
        const gorgeDist = Math.abs(z - (-8 + Math.sin(x * 0.12) * 2.5));
        if (gorgeDist < 4.5) {
          terraceH = Math.round(terraceH * (gorgeDist / 4.5)) - 1;
        }
        surfaceY = terraceH;
        if (surfaceY <= 1) { topBlock = 5; subBlock = 4; }
        else { topBlock = 3; subBlock = 4; }
      }
      // 3. 岩岸礫灘、八仙洞下層打製石器階地與三仙台陸連島起點 (X = -7 .. +3.5)
      else if (effX < 3.5) {
        const shoreSlope = (3.0 - effX) / 10.0;
        surfaceY = Math.round(shoreSlope * 3.0 + (n2 - 0.5) * 0.6);

        if (z >= -2 && z <= 9 && x >= -6 && x <= -3) {
          surfaceY = 3;
          topBlock = 5;
          subBlock = 4;
        } else if (z < -15) {
          const cuestaWave = ((x + z) % 6 + 6) % 6;
          if (cuestaWave < 3 && effX > -5) {
            surfaceY = Math.max(1, 3 - Math.floor(cuestaWave * 0.8));
            topBlock = 2; subBlock = 2;
          } else {
            topBlock = 5; subBlock = 1;
          }
        } else if (z >= 10 && z <= 16 && effX >= -4 && effX <= 3) {
          // Mainland cobble & volcanic rock headland connecting to Sanxiantai Tombolo
          surfaceY = (x >= 1 && z >= 11 && z <= 14) ? 0 : (1 + Math.floor(n2 * 1.6));
          topBlock = 5; subBlock = 1;
        } else {
          topBlock = 5;
          subBlock = 4;
        }
      }
      // 4. 潮間帶、八仙洞岸釣礁岩與三仙台陸連島（退潮連島礫石沙洲）(X = +3.5 .. +20)
      else if (effX < 20) {
        let reefY = Math.round(0.2 - ((effX - 3.5) / 16.5) * 2.2 + (n2 - 0.5) * 1.1);
        const channelPattern = Math.sin(z * 0.65 + n1 * 2.5);
        if (channelPattern > 0.75 && effX > 6) reefY -= 1;

        // Baxian Caves shoreline angling reef rock (八仙洞岸邊垂釣礁台, X = 3..6, Z = 5..7)
        if (z >= 5 && z <= 7 && x >= 3 && x <= 5) {
          surfaceY = 1;
          topBlock = 1;
          subBlock = 1;
        }
        // Northern Shitiping tuff platform
        else if (z < -16 && effX < 12 && n1 > 0.42) {
          surfaceY = Math.max(0, reefY + 1);
          topBlock = 2; subBlock = 1;
        }
        // Xiuguluan Estuary Shiqiu Island
        else if (Math.hypot(x - 9, z - (-8)) < 3.6) {
          surfaceY = Math.round(4 - Math.hypot(x - 9, z - (-8)) * 0.8);
          topBlock = 1; subBlock = 1;
        }
        // Southern Chenggong: Sanxiantai Island & Paleolithic Tombolo (三仙台陸連島與退潮連島礫石礁脊)
        else if (z >= 11 && z <= 30) {
          const dPeakLeft  = Math.hypot((x - 19.5) * 0.9, (z - 26.0) * 0.95);
          const dPeakRight = Math.hypot((x - 15.0) * 0.9, (z - 22.0) * 0.95);
          const dApron     = Math.hypot((x - 17.2) * 0.75, (z - 24.0) * 0.75);

          // Natural Tombolo Ridge (連島礫石沙洲與礁脊): spans from Mainland (X=2, Z=12.5) to Sanxiantai Island (X=11.5, Z=19.2)
          // Voxel surfaceY = -1 (top at Y = -0.5) so it is submerged at high tide (seaLevel >= 0.0)
          // and fully exposed as a walkable cobble land-bridge at low tide (seaLevel <= -0.4)!
          const tomboloCenterZ = 12.5 + ((x - 2.0) / 9.5) * 6.7 + Math.sin(x * 0.55) * 0.45;
          const distToTombolo = Math.abs(z - tomboloCenterZ);
          const isTomboloCauseway = (x >= 2 && x <= 11 && distToTombolo <= 1.85);

          if (x >= 11.5 && (dPeakLeft < 4.8 || dPeakRight < 4.6 || dApron < 5.2)) {
            const hLeft  = Math.max(0, 11.5 - dPeakLeft * 2.2);
            const hRight = Math.max(0, 10.0 - dPeakRight * 2.1);
            const hApron = Math.max(0, 2.8 - dApron * 0.50);
            surfaceY = Math.round(Math.max(hLeft, hRight, hApron));
            topBlock = surfaceY >= 2 ? 3 : 1;
            subBlock = 1;
          } else if (isTomboloCauseway) {
            surfaceY = -1; // Top surface at Y = -0.5 (submerged at high tide, exposed at low tide!)
            topBlock = (distToTombolo <= 1.15) ? 5 : 6; // 5 = Gray-black rounded cobble tombolo, 6 = Algal reef border
            subBlock = 6;
          } else {
            surfaceY = (x >= 5 && x <= 11 && distToTombolo <= 3.8) ? -2 : Math.min(-1, reefY);
            topBlock = n2 > 0.55 ? 7 : 6;
            subBlock = 6;
          }
        } else {
          surfaceY = reefY;
          if (surfaceY >= 0 && n2 > 0.48) topBlock = 7;
          else if (surfaceY <= -2 && n1 > 0.55) topBlock = 8;
          else topBlock = 6;
          subBlock = 6;
        }
      }
      // 5. 狹窄大陸棚與黑潮深海陡坡 (X >= +20)
      else {
        const dPeakLeft = Math.hypot((x - 19) * 0.9, (z - 26) * 0.95);
        if (z >= 19 && z <= 30 && dPeakLeft < 5.2) {
          surfaceY = Math.round(Math.max(0, 11.5 - dPeakLeft * 2.1));
          topBlock = surfaceY >= 2 ? 3 : 1;
          subBlock = 1;
        } else if (effX < 32) {
          const shelfT = (effX - 20) / 12;
          surfaceY = Math.round(-2 - shelfT * 4.5 + (n1 - 0.5) * 1.6);
          if (n2 > 0.65 && surfaceY >= -5) topBlock = 8;
          else topBlock = 9;
          subBlock = 9;
        } else {
          const dropT = (effX - 32) / 14;
          surfaceY = Math.round(-6.5 - Math.pow(dropT, 1.3) * 8.5 + (n2 - 0.5) * 1.5);
          topBlock = 10;
          subBlock = 10;
        }
      }

      surfaceHeightMap.set(`${x},${z}`, surfaceY);

      for (let y = WORLD_MIN_Y; y <= surfaceY; y++) {
        if (y === surfaceY) setVoxel(x, y, z, topBlock);
        else if (y >= surfaceY - 2) setVoxel(x, y, z, subBlock);
        else setVoxel(x, y, z, x > 26 ? 10 : 1);
      }
    }
  }

  // 石門海蝕洞 (March Cave)
  for (let z = -16; z <= -14; z++) {
    for (let x = -3; x <= 1; x++) {
      for (let y = 0; y <= 2; y++) removeVoxel(x, y, z);
    }
  }

  // 八仙洞開放式海蝕岩蔭洞群
  for (let z = 3; z <= 7; z++) {
    for (let x = -17; x <= -14; x++) {
      const maxCaveY = (x === -14) ? 9 : 8;
      for (let y = 6; y <= maxCaveY; y++) removeVoxel(x, y, z);
    }
  }
  for (let z = -2; z <= 1; z++) {
    for (let x = -16; x <= -14; x++) {
      const maxCaveY = (x === -14) ? 8 : 7;
      for (let y = 6; y <= maxCaveY; y++) removeVoxel(x, y, z);
    }
  }
  for (let z = -2; z <= 8; z++) {
    setVoxel(-14, 5, z, 1);
    setVoxel(-15, 5, z, 1);
  }

  // 史前巨石地標
  [{ x: -12, z: -22 }, { x: -10, z: -19 }, { x: -11, z: 15 }].forEach(pos => {
    const sy = getSurfaceY(pos.x, pos.z);
    setVoxel(pos.x, sy + 1, pos.z, 14);
    setVoxel(pos.x, sy + 2, pos.z, 14);
  });

  // 海岸山脈雨林與海階林木 (避開八仙洞開放式聚落劇場)
  for (let z = WORLD_MIN_Z + 3; z <= WORLD_MAX_Z - 3; z += 4) {
    for (let x = WORLD_MIN_X + 3; x <= -15; x += 4) {
      const r = hash2D(x * 1.7, z * 2.3);
      if (r > 0.62) {
        const tx = x + (r > 0.8 ? 1 : 0);
        const tz = z + (r > 0.7 ? -1 : 0);
        if (tz >= -4 && tz <= 11 && tx >= -22 && tx <= -7) continue;
        const groundY = getSurfaceY(tx, tz);
        const groundBlock = getVoxel(tx, groundY, tz);
        if ((groundBlock === 11 || groundBlock === 3) && groundY > 2 && groundY < 23) {
          const trunkH = 3 + (r > 0.78 ? 1 : 0);
          for (let ty = 1; ty <= trunkH; ty++) setVoxel(tx, groundY + ty, tz, 12);
          for (let lx = -2; lx <= 2; lx++) {
            for (let lz = -2; lz <= 2; lz++) {
              for (let ly = trunkH - 1; ly <= trunkH + 1; ly++) {
                if (Math.abs(lx) + Math.abs(lz) + Math.abs(ly - trunkH) <= 3 && !(lx === 0 && lz === 0 && ly <= trunkH)) {
                  setVoxel(tx + lx, groundY + ly, tz + lz, 13);
                }
              }
            }
          }
        }
      }
    }
  }
}

// =========================================================================
// THREE.JS 場景、東海岸晴空、星空明月與三仙台舊石器陸連島礁石步道
// =========================================================================
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2b82e3);
scene.fog = new THREE.FogExp2(0x6eb8f5, 0.0032);

const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 420);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xe0f2fe, 0.82);
scene.add(ambientLight);

const sunDirection = new THREE.Vector3(0.58, 0.52, 0.62).normalize();
const sunLight = new THREE.DirectionalLight(0xfffef5, 1.15);
sunLight.position.copy(sunDirection).multiplyScalar(120);
scene.add(sunLight);

const skyGroup = new THREE.Group();
scene.add(skyGroup);
const daySkyGroup = new THREE.Group();
const nightSkyGroup = new THREE.Group();
nightSkyGroup.visible = false;
skyGroup.add(daySkyGroup, nightSkyGroup);

function buildSunnyEastCoastSky() {
  const sunGeo = new THREE.SphereGeometry(5.5, 24, 24);
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const sunMesh = new THREE.Mesh(sunGeo, sunMat);
  sunMesh.position.copy(sunDirection).multiplyScalar(180);
  daySkyGroup.add(sunMesh);

  const cloudMat = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    emissive: 0xdbeafe,
    emissiveIntensity: 0.35,
    transparent: true,
    opacity: 0.92
  });
  const cloudClusters = [
    { x: 55, y: 34, z: 45, s: 1.4 },
    { x: 68, y: 28, z: 12, s: 1.2 },
    { x: 60, y: 38, z: -22, s: 1.5 },
    { x: 35, y: 42, z: 65, s: 1.3 },
    { x: 10, y: 36, z: 75, s: 1.1 }
  ];
  cloudClusters.forEach(c => {
    const cg = new THREE.Group();
    cg.position.set(c.x, c.y, c.z);
    const puffs = [
      [0, 0, 0, 9, 2.8, 5],
      [-4, -0.6, 1, 6, 2.2, 4],
      [4.5, -0.4, -1, 6.5, 2.4, 4.5],
      [1, 1.4, 0, 5.5, 2.2, 3.8]
    ];
    puffs.forEach(([px, py, pz, sx, sy, sz]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), cloudMat);
      m.position.set(px, py, pz);
      cg.add(m);
    });
    cg.scale.setScalar(c.s);
    daySkyGroup.add(cg);
  });

  // Nighttime Pacific Full Moon + Starfield
  const moonDir = new THREE.Vector3(0.55, 0.48, 0.68).normalize();
  const moonMesh = new THREE.Mesh(
    new THREE.SphereGeometry(6.2, 24, 24),
    new THREE.MeshBasicMaterial({ color: 0xfef9c3 })
  );
  moonMesh.position.copy(moonDir).multiplyScalar(175);
  nightSkyGroup.add(moonMesh);

  const moonHalo = new THREE.Mesh(
    new THREE.SphereGeometry(10.5, 24, 24),
    new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.22 })
  );
  moonHalo.position.copy(moonMesh.position);
  nightSkyGroup.add(moonHalo);

  const starPositions = [];
  const starColors = [];
  const palette = [
    new THREE.Color(0xffffff),
    new THREE.Color(0xbae6fd),
    new THREE.Color(0xfef08a),
    new THREE.Color(0xe0e7ff)
  ];
  for (let i = 0; i < 320; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = 0.08 + Math.random() * (Math.PI * 0.44);
    const r = 195 + Math.random() * 25;
    starPositions.push(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta)
    );
    const col = palette[i % palette.length];
    starColors.push(col.r, col.g, col.b);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
  starGeo.setAttribute('color', new THREE.Float32BufferAttribute(starColors, 3));
  const starMat = new THREE.PointsMaterial({ size: 2.2, vertexColors: true, transparent: true, opacity: 0.95 });
  const starPoints = new THREE.Points(starGeo, starMat);
  nightSkyGroup.add(starPoints);
}

// =========================================================================
// 三仙台舊石器時期「陸連島（連島礫石沙洲與礁石步道）」(移除現代八拱橋！)
// 漲潮時沒入海浪之下，退潮時浮現連島礫石礁脊，可徒步走過去登島！
// =========================================================================
const tomboloGroup = new THREE.Group();
scene.add(tomboloGroup);

function buildSanxiantaiTombolo() {
  const cobbleMat1 = new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.85 });
  const cobbleMat2 = new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.90 });
  const reefRockMat = new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.92 });
  const mossMat = new THREE.MeshLambertMaterial({ color: 0x16a34a });

  // Natural curving tombolo spit from mainland shore (X=2.0, Z=12.5) to Sanxiantai Island (X=12.8, Z=20.3)
  const steps = 28;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cx = 2.0 + t * 10.8;
    const cz = 12.5 + t * 7.8 + Math.sin(cx * 0.55) * 0.55;

    // Central rounded cobble & boulder stepping stones (sits at Y = -0.38 .. -0.08)
    // Submerged when seaLevel >= 0.0, exposed above water when seaLevel <= -0.35!
    const mainStoneW = 0.85 + (i % 3) * 0.22;
    const mainStoneL = 0.95 + (i % 2) * 0.28;
    const mainStoneH = 0.28 + (i % 4) * 0.05;
    const stone = new THREE.Mesh(
      new THREE.BoxGeometry(mainStoneW, mainStoneH, mainStoneL),
      i % 2 === 0 ? cobbleMat1 : cobbleMat2
    );
    stone.position.set(cx, -0.46 + mainStoneH * 0.5, cz);
    stone.rotation.y = (i * 0.7) % Math.PI;
    tomboloGroup.add(stone);

    // Side cobble bank & mossy reef boulders along the tombolo spit
    [-1, 1].forEach(side => {
      const offsetZ = side * (0.75 + (i % 3) * 0.25);
      const pebble = new THREE.Mesh(
        new THREE.BoxGeometry(0.62, 0.22, 0.68),
        side > 0 ? cobbleMat2 : reefRockMat
      );
      pebble.position.set(cx + (side * 0.18), -0.48 + 0.11, cz + offsetZ);
      pebble.rotation.y = i * 0.4;
      tomboloGroup.add(pebble);

      if (i % 3 === 0) {
        const algaePatch = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.36), mossMat);
        algaePatch.position.set(cx, -0.35, cz + offsetZ * 0.8);
        tomboloGroup.add(algaePatch);
      }
    });

    // Occasional larger volcanic sea-stack boulders along the tombolo margin that peek out at mid-tide
    if (i % 5 === 2) {
      const boulder = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.55, 0.75), reefRockMat);
      boulder.position.set(cx - 0.2, -0.32, cz + (i % 2 === 0 ? 1.25 : -1.25));
      boulder.rotation.set(0.1, i * 0.5, -0.08);
      tomboloGroup.add(boulder);
    }
  }
}

// =========================================================================
// 地形體素 InstancedMesh 建構（含礫石灘與陸連島動態濕潤光澤更新）
// =========================================================================
const unitBoxGeo = new THREE.BoxGeometry(1, 1, 1);
const instancedMeshes = {};
const instanceCoordLookup = {};
let currentSliceZ = 36;
let currentZoneHighlight = 'ALL';

function isVoxelExposed(x, y, z) {
  if (z === currentSliceZ || z === WORLD_MIN_Z || x === WORLD_MIN_X || x === WORLD_MAX_X || y === WORLD_MIN_Y) return true;
  return (
    getVoxel(x + 1, y, z) === 0 ||
    getVoxel(x - 1, y, z) === 0 ||
    getVoxel(x, y + 1, z) === 0 ||
    getVoxel(x, y - 1, z) === 0 ||
    getVoxel(x, y, z + 1) === 0 ||
    getVoxel(x, y, z - 1) === 0
  );
}

function rebuildInstancedMeshes() {
  Object.values(instancedMeshes).forEach(mesh => {
    scene.remove(mesh);
    mesh.dispose();
  });

  const buckets = {};
  BLOCK_DEFS.forEach(def => { buckets[def.id] = []; });

  let visibleCount = 0;
  for (const [key, blockId] of voxelMap.entries()) {
    const [x, y, z] = key.split(',').map(Number);
    if (z > currentSliceZ) continue;
    if (!isVoxelExposed(x, y, z)) continue;
    buckets[blockId].push({ x, y, z });
    visibleCount++;
  }

  const dummy = new THREE.Object3D();
  const colorTint = new THREE.Color();

  BLOCK_DEFS.forEach(def => {
    const list = buckets[def.id];
    instanceCoordLookup[def.id] = list;
    if (list.length === 0) return;

    const mesh = new THREE.InstancedMesh(unitBoxGeo, blockMaterials[def.id], list.length);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    for (let i = 0; i < list.length; i++) {
      const { x, y, z } = list[i];
      dummy.position.set(x, y, z);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      const zoneCode = getZoneInfoByX(x).code;
      if (currentZoneHighlight !== 'ALL' && zoneCode !== currentZoneHighlight) {
        colorTint.setRGB(0.32, 0.36, 0.42);
      } else {
        let shade = Math.max(0.72, Math.min(1.12, 0.94 + y * 0.008));
        const seaRef = (typeof seaLevel !== 'undefined') ? seaLevel : 0.1;
        if ((def.id === 5 || def.id === 1 || def.id === 6) && y <= seaRef + 1.2) {
          shade *= 0.68;
        }
        colorTint.setRGB(shade, shade, shade);
      }
      mesh.setColorAt(i, colorTint);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    scene.add(mesh);
    instancedMeshes[def.id] = mesh;
  });

  const badge = document.getElementById('block-count-badge');
  if (badge) badge.textContent = `地形體素: ${visibleCount.toLocaleString()} 格`;
}

