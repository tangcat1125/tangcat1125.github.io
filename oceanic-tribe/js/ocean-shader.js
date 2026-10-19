    // =========================================================================
    // 5. 突破級 GLSL 海洋著色器：慢速湧浪、微觀碎鑽波光、寶石藍-翡翠綠漸層、蕾絲洗岸白沫
    // =========================================================================
    let seaLevel = 0.1;
    let autoTide = false;
    let waveSpeedMultiplier = 0.45; // Slow, majestic real-ocean wave rhythm!
    let waveHeightMultiplier = 0.85;
    let simTime = 0;
    let wavePhaseTime = 0;

    // Create DataTexture encoding seabed elevation (surfaceY) across X=(-8..46), Z=(-32..32)
    // so the GLSL shader knows the exact water depth at every pixel for turquoise color & shore foam!
    const DEPTH_TEX_W = 128;
    const DEPTH_TEX_H = 128;
    const OCEAN_MIN_X = -8.0;
    const OCEAN_MAX_X = 46.0;
    const OCEAN_MIN_Z = -32.5;
    const OCEAN_MAX_Z = 32.5;

    let seabedDataTex = null;

    function buildSeabedDepthTexture() {
      const data = new Uint8Array(DEPTH_TEX_W * DEPTH_TEX_H * 4);
      for (let iz = 0; iz < DEPTH_TEX_H; iz++) {
        const wz = OCEAN_MIN_Z + (iz / (DEPTH_TEX_H - 1)) * (OCEAN_MAX_Z - OCEAN_MIN_Z);
        for (let ix = 0; ix < DEPTH_TEX_W; ix++) {
          const wx = OCEAN_MIN_X + (ix / (DEPTH_TEX_W - 1)) * (OCEAN_MAX_X - OCEAN_MIN_X);

          // Bilinear interpolation of surfaceHeightMap for smooth shoreline contour
          const x0 = Math.floor(wx), x1 = Math.ceil(wx);
          const z0 = Math.floor(wz), z1 = Math.ceil(wz);
          const fx = wx - x0, fz = wz - z0;
          const h00 = getSurfaceY(x0, z0), h10 = getSurfaceY(x1, z0);
          const h01 = getSurfaceY(x0, z1), h11 = getSurfaceY(x1, z1);
          const hInterp = (h00 * (1 - fx) + h10 * fx) * (1 - fz) + (h01 * (1 - fx) + h11 * fx) * fz;

          // Map elevation [-16 .. +16] to [0 .. 255]
          const normH = Math.max(0, Math.min(255, Math.round(((hInterp + 16.0) / 32.0) * 255)));
          const idx = (iz * DEPTH_TEX_W + ix) * 4;
          data[idx] = normH;
          data[idx + 1] = normH;
          data[idx + 2] = normH;
          data[idx + 3] = 255;
        }
      }
      if (seabedDataTex) seabedDataTex.dispose();
      seabedDataTex = new THREE.DataTexture(data, DEPTH_TEX_W, DEPTH_TEX_H, THREE.RGBAFormat);
      seabedDataTex.magFilter = THREE.LinearFilter;
      seabedDataTex.minFilter = THREE.LinearFilter;
      seabedDataTex.wrapS = THREE.ClampToEdgeWrapping;
      seabedDataTex.wrapT = THREE.ClampToEdgeWrapping;
      seabedDataTex.needsUpdate = true;
    }

    const oceanVertexShader = `
      uniform float uTime;
      uniform float uSeaLevel;
      uniform float uWaveHeight;
      uniform float uSliceZ;
      uniform sampler2D uSeabedTex;

      varying vec3 vWorldPos;
      varying vec2 vOceanUV;
      varying float vSeabedY;
      varying float vWaveCrest;

      // Smooth 2D noise in vertex shader
      float vHash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float vNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(vHash(i + vec2(0.0, 0.0)), vHash(i + vec2(1.0, 0.0)), u.x),
          mix(vHash(i + vec2(0.0, 1.0)), vHash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vec2 uv = vec2(
          (worldPosition.x - (${OCEAN_MIN_X.toFixed(1)})) / (${(OCEAN_MAX_X - OCEAN_MIN_X).toFixed(1)}),
          (worldPosition.z - (${OCEAN_MIN_Z.toFixed(1)})) / (${(OCEAN_MAX_Z - OCEAN_MIN_Z).toFixed(1)})
        );
        vOceanUV = clamp(uv, 0.0, 1.0);

        float encodedH = texture2D(uSeabedTex, vOceanUV).r;
        float seabedY = encodedH * 32.0 - 16.0;
        vSeabedY = seabedY;

        float wx = worldPosition.x;
        float wz = worldPosition.z;

        // Multi-directional Gerstner-like swell rolling from Pacific (+X) to Shore (-X)
        // Notice the slow, realistic frequency!
        float distFactor = smoothstep(-5.0, 14.0, wx);
        float shoaling = 1.0 + (1.0 - smoothstep(1.0, 16.0, wx)) * 0.45;

        float phase1 = wx * 0.34 + uTime * 1.45 + sin(wz * 0.11) * 1.6;
        float phase2 = wx * 0.58 - wz * 0.21 + uTime * 1.85;
        float phase3 = wx * 0.22 + wz * 0.26 + uTime * 1.10;

        // Trochoidal wave peaking (steeper crests, wide flat troughs)
        float swell1 = sin(phase1) + 0.26 * sin(phase1 * 2.0);
        float swell2 = 0.42 * sin(phase2) + 0.25 * cos(phase3);

        // Shore swash run-up (浪舌輕緩推上礫灘)
        float swashRunup = sin(uTime * 1.45 + wz * 0.08) * 0.28;

        float totalDisp = (swell1 * 0.26 + swell2 * 0.16) * uWaveHeight * shoaling * distFactor
                        + swashRunup * (1.0 - distFactor) * uWaveHeight;

        worldPosition.y = uSeaLevel + 0.38 + totalDisp;
        if (wz > uSliceZ) {
          worldPosition.y = -40.0;
        }

        vWaveCrest = clamp((swell1 + 0.8) * 0.5 * shoaling, 0.0, 1.0);
        vWorldPos = worldPosition.xyz;

        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `;

    const oceanFragmentShader = `
      uniform float uTime;
      uniform float uSeaLevel;
      uniform float uWaveHeight;
      uniform float uSliceZ;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform vec3 uSkyZenithColor;
      uniform vec3 uSkyHorizonColor;
      uniform vec3 uDeepColor;
      uniform vec3 uMidTurquoiseColor;
      uniform vec3 uShallowCyanColor;

      varying vec3 vWorldPos;
      varying vec2 vOceanUV;
      varying float vSeabedY;
      varying float vWaveCrest;

      // High-quality 2D hash & value noise for capillary wavelets and lacy foam
      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      // Cellular Voronoi pattern for realistic lacy ocean foam (蕾絲網狀浪沫)
      float cellularFoam(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        float minDist1 = 1.0;
        float minDist2 = 1.0;
        for (int y = -1; y <= 1; y++) {
          for (int x = -1; x <= 1; x++) {
            vec2 neighbor = vec2(float(x), float(y));
            vec2 pt = vec2(hash(i + neighbor), hash(i + neighbor + vec2(17.0, 31.0)));
            pt = 0.5 + 0.45 * sin(uTime * 0.65 + 6.2831 * pt);
            vec2 diff = neighbor + pt - f;
            float d = length(diff);
            if (d < minDist1) {
              minDist2 = minDist1;
              minDist1 = d;
            } else if (d < minDist2) {
              minDist2 = d;
            }
          }
        }
        // Web/lace ridge between bubble cells
        return smoothstep(0.16, 0.02, minDist2 - minDist1);
      }

      // Compute multi-scale capillary wave surface height at world xz for per-pixel normal
      float waveHeightMap(vec2 xz) {
        // Layer 1: Primary swell towards shore (-X)
        float w1 = sin(xz.x * 0.45 + uTime * 1.45 + sin(xz.y * 0.14) * 1.3) * 0.22;
        // Layer 2: Cross-swell
        float w2 = sin(xz.x * 0.85 - xz.y * 0.35 + uTime * 1.90) * 0.11;
        // Layer 3: Medium wind ripples
        float w3 = noise(xz * 1.35 + vec2(uTime * 0.75, -uTime * 0.45)) * 0.065;
        // Layer 4: Fine capillary facets (produces individual diamond sparkles!)
        float w4 = noise(xz * 3.80 + vec2(-uTime * 1.15, uTime * 0.85)) * 0.026;
        float w5 = noise(xz * 8.50 + vec2(uTime * 1.60, uTime * 1.25)) * 0.012;
        return (w1 + w2 + w3 + w4 + w5) * uWaveHeight;
      }

      vec3 computeWaveNormal(vec2 xz) {
        float eps = 0.09;
        float hC = waveHeightMap(xz);
        float hX = waveHeightMap(xz + vec2(eps, 0.0));
        float hZ = waveHeightMap(xz + vec2(0.0, eps));
        return normalize(vec3(hC - hX, eps, hC - hZ));
      }

      void main() {
        if (vWorldPos.z > uSliceZ) discard;

        // Water depth above seabed (礫灘與礁岩水深)
        float waterDepth = vWorldPos.y - vSeabedY;
        if (waterDepth < -0.08) discard;

        vec2 xz = vWorldPos.xz;
        vec3 N = computeWaveNormal(xz);
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 L = normalize(uSunDir);

        // 1. East Coast Depth-Based Color Gradient (完全還原照片中的深海鈷藍 ➔ 近海寶石翡翠綠 ➔ 岸邊清澈透底)
        float deepFactor = smoothstep(2.0, 9.5, waterDepth) * smoothstep(10.0, 32.0, vWorldPos.x);
        float shallowFactor = 1.0 - smoothstep(0.0, 3.2, waterDepth);

        vec3 waterBodyColor = mix(uMidTurquoiseColor, uDeepColor, deepFactor);
        waterBodyColor = mix(waterBodyColor, uShallowCyanColor, shallowFactor * 0.75);

        // Subsurface wave-crest turquoise glow when sunlight passes through wave peaks
        float sss = pow(max(0.0, dot(V, -L + N * 0.6)), 3.0) * vWaveCrest * (1.0 - deepFactor * 0.5);
        waterBodyColor += vec3(0.04, 0.36, 0.42) * sss;

        // 2. Schlick Fresnel Sky Reflection (natural grazing angle reflection, NOT a flat sheet!)
        float NdotV = max(0.001, dot(N, V));
        float fresnel = 0.02 + 0.98 * pow(1.0 - NdotV, 4.8);
        vec3 reflDir = reflect(-V, N);
        vec3 skyRefl = mix(uSkyHorizonColor, uSkyZenithColor, clamp(reflDir.y * 0.8 + 0.2, 0.0, 1.0));
        vec3 baseColor = mix(waterBodyColor, skyRefl, fresnel * 0.52);

        // 3. True Micro-Facet Diamond Sun Glints & Wave-Crest Whitecaps
        // 結合太陽方向與視角自適應波面反射，確保無論從哪個角度觀察海岸，海面都保有如照片般層次豐富的銀白浪花與碎鑽波光！
        vec2 viewHoriz = normalize(vec2(V.x, V.z) + vec2(0.0001));
        vec3 L_viewGlint = normalize(vec3(-viewHoriz.x * 0.56 + 0.10, 0.54, -viewHoriz.y * 0.56));
        vec3 H_sun = normalize(L + V);
        vec3 H_view = normalize(L_viewGlint + V);
        float NdotH = max(dot(N, H_sun), dot(N, H_view) * 0.995);

        // High-frequency facet sparkle mask so glints break into thousands of tiny points
        float facetSparkle1 = noise(xz * 6.5 + vec2(uTime * 1.4, -uTime * 1.1));
        float facetSparkle2 = noise(xz * 14.0 + vec2(-uTime * 1.9, uTime * 1.6));
        float sparkleMask = smoothstep(0.45, 0.80, facetSparkle1 * 0.55 + facetSparkle2 * 0.45);

        // Broad soft sun sheen + ultra-sharp diamond pinpoints
        float sunEnvelope = pow(NdotH, 36.0) * 0.34;
        float diamondPinpoints = pow(NdotH, 280.0) * 3.0 + pow(NdotH, 58.0) * sparkleMask * 1.65;
        vec3 specularGlint = uSunColor * (sunEnvelope + diamondPinpoints);

        // 4. Shore-Breaking Surf & Lacy Swash Foam (完整還原照片：灰黑礫灘與島礁周圍層層推進的潔白浪花與蕾絲網狀水沫)
        float swashWavePhase  = sin(xz.x * 0.65 + uTime * 1.45 + noise(xz * 0.22) * 2.4);
        float swashWavePhase2 = sin(xz.x * 1.10 - xz.y * 0.18 + uTime * 1.85 + noise(xz * 0.35) * 2.0);

        // Primary whitewater lip right along the visible cobble beach & rocky outcrops (accounting for +0.5 voxel top)
        float shoreEdgeFoam = smoothstep(1.35, 0.28, waterDepth);
        // Rolling surf breaker lines across the intertidal & shallow reef zone
        float breakerLine1 = smoothstep(0.42, 0.88, swashWavePhase) * smoothstep(3.4, 0.45, waterDepth) * smoothstep(-0.05, 0.35, waterDepth);
        float breakerLine2 = smoothstep(0.52, 0.92, swashWavePhase2) * smoothstep(4.6, 0.80, waterDepth) * 0.65;
        // Offshore wave-crest whitecaps on steep trochoidal wave peaks
        float waveCrestFoam = smoothstep(0.62, 0.95, vWaveCrest) * sparkleMask * 0.48;

        // Cellular lace foam texture (蕾絲網狀浪沫)
        float lace1 = cellularFoam(xz * 1.35 + vec2(uTime * 0.25, 0.0));
        float lace2 = noise(xz * 4.5 + vec2(uTime * 0.35, -uTime * 0.2));
        float lacePattern = clamp(lace1 * 0.78 + lace2 * 0.48, 0.0, 1.0);

        float totalFoam = clamp(
          shoreEdgeFoam * (0.68 + 0.32 * lacePattern) +
          (breakerLine1 + breakerLine2) * (0.48 + 0.52 * lace1) +
          smoothstep(2.65, 0.30, waterDepth) * lace1 * 0.52 +
          waveCrestFoam,
          0.0, 1.0
        );

        vec3 foamColor = vec3(0.96, 0.99, 1.0);
        vec3 finalRGB = mix(baseColor + specularGlint, foamColor, totalFoam);

        // Crystal-clear alpha right at the wet pebble swash edge
        float edgeAlpha = smoothstep(-0.06, 0.18, waterDepth);
        float alpha = clamp(mix(0.86, 0.98, totalFoam) * edgeAlpha, 0.0, 0.98);

        gl_FragColor = vec4(finalRGB, alpha);
      }
    `;

    const OCEAN_W = OCEAN_MAX_X - OCEAN_MIN_X;
    const OCEAN_L = OCEAN_MAX_Z - OCEAN_MIN_Z;
    const oceanGeo = new THREE.PlaneGeometry(OCEAN_W, OCEAN_L, 128, 128);
    oceanGeo.rotateX(-Math.PI / 2);

    const oceanUniforms = {
      uTime:              { value: 0 },
      uSeaLevel:          { value: seaLevel },
      uWaveHeight:        { value: waveHeightMultiplier },
      uSliceZ:            { value: currentSliceZ },
      uSeabedTex:         { value: null },
      uSunDir:            { value: sunDirection.clone() },
      uSunColor:          { value: new THREE.Color(0xffffff) },
      uSkyZenithColor:    { value: new THREE.Color(0x0b66d6) },
      uSkyHorizonColor:   { value: new THREE.Color(0x7cc8ff) },
      uDeepColor:         { value: new THREE.Color(0x004e9a) }, // Deep Pacific Sapphire
      uMidTurquoiseColor: { value: new THREE.Color(0x009dc4) }, // East Coast Luminous Turquoise
      uShallowCyanColor:  { value: new THREE.Color(0x28c7d9) }  // Shallow Reef/Pebble Aquamarine
    };

    const oceanShaderMat = new THREE.ShaderMaterial({
      vertexShader: oceanVertexShader,
      fragmentShader: oceanFragmentShader,
      uniforms: oceanUniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    const oceanSurfaceMesh = new THREE.Mesh(oceanGeo, oceanShaderMat);
    oceanSurfaceMesh.position.set((OCEAN_MIN_X + OCEAN_MAX_X) * 0.5, 0, 0);
    scene.add(oceanSurfaceMesh);

    // Subtle side water skirt for geological cross-section view
    const deepSkirtGeo = new THREE.BoxGeometry(OCEAN_W, 13, OCEAN_L);
    const deepSkirtMat = new THREE.MeshLambertMaterial({
      color: 0x0066a6,
      transparent: true,
      opacity: 0.38
    });
    const deepSkirtMesh = new THREE.Mesh(deepSkirtGeo, deepSkirtMat);
    deepSkirtMesh.position.set((OCEAN_MIN_X + OCEAN_MAX_X) * 0.5, seaLevel - 6.6, 0);
    scene.add(deepSkirtMesh);

    // Gentle Mist Spray right where swells hit the dark volcanic rocks of Sanxiantai & Shimen
    const SPRAY_COUNT = 120;
    const sprayGeo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
    const sprayMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.78 });
    const sprayInstanced = new THREE.InstancedMesh(sprayGeo, sprayMat, SPRAY_COUNT);
    const sprayParticles = [];
    for (let i = 0; i < SPRAY_COUNT; i++) {
      sprayParticles.push({
        x: 6, y: -99, z: 15,
        vx: 0, vy: 0, vz: 0,
        life: Math.random(),
        maxLife: 0.9 + Math.random() * 0.7,
        size: 0.4 + Math.random() * 0.7
      });
    }
    scene.add(sprayInstanced);

    function updateDynamicOcean(dt) {
      wavePhaseTime += dt * waveSpeedMultiplier;
      oceanUniforms.uTime.value = wavePhaseTime;
      oceanUniforms.uSeaLevel.value = seaLevel;
      oceanUniforms.uWaveHeight.value = waveHeightMultiplier;
      oceanUniforms.uSliceZ.value = currentSliceZ;
      deepSkirtMesh.position.y = seaLevel - 6.6;

      // Gentle sea spray around reef rocks (Z = 12..25, X = 4..14)
      const dummy = new THREE.Object3D();
      for (let i = 0; i < SPRAY_COUNT; i++) {
        const sp = sprayParticles[i];
        sp.life += dt * (0.6 + waveSpeedMultiplier);
        if (sp.life >= sp.maxLife) {
          sp.life = 0;
          if (i % 2 === 0) {
            // Around Sanxiantai reef rocks
            sp.z = 12 + Math.random() * 14;
            sp.x = 4 + Math.random() * 10;
          } else {
            // Along main reef edge
            sp.z = WORLD_MIN_Z + Math.random() * (Math.min(WORLD_MAX_Z, currentSliceZ) - WORLD_MIN_Z);
            sp.x = 2.5 - seaLevel * 2.5 + (Math.random() - 0.5) * 3.0;
          }
          const gy = getSurfaceY(sp.x, sp.z);
          sp.y = Math.max(gy + 0.2, seaLevel + 0.25);
          sp.vx = -(0.6 + Math.random() * 1.4) * waveHeightMultiplier;
          sp.vy = (1.5 + Math.random() * 2.2) * waveHeightMultiplier;
          sp.vz = (Math.random() - 0.5) * 0.8;
        }
        sp.x += sp.vx * dt;
        sp.y += sp.vy * dt;
        sp.z += sp.vz * dt;
        sp.vy -= 6.5 * dt;

        const scale = sp.size * Math.sin((sp.life / sp.maxLife) * Math.PI);
        dummy.position.set(sp.x, sp.y, sp.z);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        sprayInstanced.setMatrixAt(i, dummy.matrix);
      }
      sprayInstanced.instanceMatrix.needsUpdate = true;
    }
