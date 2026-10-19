    // =========================================================================
    // 6B. 八仙洞舊石器聚落（長濱文化）全族日夜作息、廣域狩獵、女性海邊採集與居家生態
    // =========================================================================
    const tribeGroup = new THREE.Group();
    scene.add(tribeGroup);

    let currentTimeOfDay = 'NOON'; // 'NOON' | 'DAWN' | 'DUSK' | 'NIGHT'
    let autoDayNightCycle = false;
    let autoDayNightTimer = 0;

    const tribeAnimState = {
      fireGroup: null,
      flames: [],
      smokeParticles: [],
      fireLight: null,
      caveInteriorLight1: null,
      caveInteriorLight2: null,
      zzzSprites: [],
      fireTenderA: null,
      fireTenderB: null,
      roastRackMeat: null,

      woodGathererA: null,
      woodCarrierB: null,

      barkBeaterHuman: null,
      barkClothSheet: null,
      vineWeaverHuman: null,
      vineRopeCoil: null,

      stoneKnapperA: null,
      stoneKnapperB: null,
      knapSparks: [],

      hunterA: null,
      hunterB: null,
      hunterC: null,
      wildBoar: null,
      barkingDeer: null,

      foragerWomen: [],

      sampanBoat: null,
      sampanPaddler: null,
      sampanHarpooner: null,
      shoreAngler: null,
      fishingRodGroup: null,
      fishingRodTip: null,
      hookedFish: null,
      fishingLine: null,

      allHumans: [] // Registered for unified WORK / DINE (回家吃飯) / SLEEP (入洞睡覺) transitions!
    };

    // Bilinear smooth terrain surface height sampler so roaming hunters/animals step smoothly across terraces!
    function getSmoothGroundY(wx, wz) {
      const x0 = Math.floor(wx);
      const z0 = Math.floor(wz);
      const tx = wx - x0;
      const tz = wz - z0;
      const y00 = getSurfaceY(x0, z0);
      const y10 = getSurfaceY(x0 + 1, z0);
      const y01 = getSurfaceY(x0, z0 + 1);
      const y11 = getSurfaceY(x0 + 1, z0 + 1);
      const y0 = y00 * (1 - tx) + y10 * tx;
      const y1 = y01 * (1 - tx) + y11 * tx;
      return (y0 * (1 - tz) + y1 * tz) + 0.5;
    }

    // Wide-ranging patrol & hunting loop that winds ALL AROUND the Baxian Caves settlement!
    // Covers: Upper Plateau (-18, Z=0..8) ➔ North Yong'an Terrace (-11, Z=-7..-2) ➔ Middle Cave Plaza Rim (-8.5, Z=-1..7) ➔ Lower Cobble Terrace (-5.5, Z=3..9) ➔ South Slope (-13, Z=8..11)
    function getWideHuntTrailPoint(phaseAngle, radialOffset = 0) {
      const a = phaseAngle;
      const wx = -11.8 + Math.cos(a) * (5.6 + radialOffset) + Math.sin(a * 2.0) * 1.4;
      const wz = 2.2 + Math.sin(a) * (7.2 + radialOffset) + Math.cos(a * 2.0) * 1.1;
      // Analytical derivative for smooth forward facing direction
      const vx = -Math.sin(a) * (5.6 + radialOffset) + 2.0 * Math.cos(a * 2.0) * 1.4;
      const vz =  Math.cos(a) * (7.2 + radialOffset) - 2.0 * Math.sin(a * 2.0) * 1.1;
      const wy = getSmoothGroundY(wx, wz);
      return { wx, wy, wz, yaw: Math.atan2(vx, vz) };
    }

    // Build an articulated Minecraft/Voxel-style Paleolithic Human figure (supports Male & Female, Baskets, Tools, and Food Skewers)
    function buildPrehistoricHumanMesh(options = {}) {
      const {
        speciesKey = 'HUMAN_FIRE',
        skinColor = 0xc68652,
        hairColor = 0x1c1917,
        tunicColor = 0x854d0e,
        bandColor = 0xd97706,
        isFemale = false,
        hasBackBasket = false,
        isSeated = false,
        scale = 1.0
      } = options;

      const root = new THREE.Group();
      root.scale.setScalar(scale);

      const skinMat  = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.75 });
      const hairMat  = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.9 });
      const tunicMat = new THREE.MeshStandardMaterial({ color: tunicColor, roughness: 0.88 });
      const bandMat  = new THREE.MeshStandardMaterial({ color: bandColor, roughness: 0.7 });
      const eyeMat   = new THREE.MeshBasicMaterial({ color: 0x0f172a });

      // Torso pivot (for bending / breathing / paddling / sleeping)
      const torsoPivot = new THREE.Group();
      torsoPivot.position.set(0, isSeated ? 0.28 : 0.48, 0);
      root.add(torsoPivot);

      // Torso (chest + bark-cloth tunic/skirt)
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.44, 0.20), skinMat);
      torso.position.set(0, 0.22, 0);
      torsoPivot.add(torso);

      const tunicH = isFemale ? 0.38 : 0.30;
      const tunic = new THREE.Mesh(new THREE.BoxGeometry(0.37, tunicH, 0.23), tunicMat);
      tunic.position.set(0, isFemale ? 0.17 : 0.14, 0);
      torsoPivot.add(tunic);

      // Optional woven rattan back-basket filled with green seaweed & shells (女性海邊採集藤編背簍)
      if (hasBackBasket) {
        const basketMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.85 });
        const basket = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.32, 0.22), basketMat);
        basket.position.set(0, 0.24, -0.20);
        torsoPivot.add(basket);

        const seaweedTop = new THREE.Mesh(
          new THREE.BoxGeometry(0.24, 0.10, 0.18),
          new THREE.MeshLambertMaterial({ color: 0x16a34a })
        );
        seaweedTop.position.set(0, 0.42, -0.20);
        torsoPivot.add(seaweedTop);
      }

      // Head + Hair + Woven Vine / Shell Headband
      const headGroup = new THREE.Group();
      headGroup.position.set(0, 0.46, 0);
      torsoPivot.add(headGroup);

      const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), skinMat);
      head.position.set(0, 0.14, 0);
      headGroup.add(head);

      const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.12, 0.30), hairMat);
      hairTop.position.set(0, 0.26, -0.01);
      headGroup.add(hairTop);

      const hairBack = new THREE.Mesh(
        new THREE.BoxGeometry(isFemale ? 0.26 : 0.28, isFemale ? 0.34 : 0.22, 0.11),
        hairMat
      );
      hairBack.position.set(0, isFemale ? 0.09 : 0.15, -0.14);
      headGroup.add(hairBack);

      const headBand = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.05, 0.31), bandMat);
      headBand.position.set(0, 0.21, 0);
      headGroup.add(headBand);

      const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.02), eyeMat);
      eyeL.position.set(-0.06, 0.15, 0.145);
      const eyeR = eyeL.clone();
      eyeR.position.x = 0.06;
      headGroup.add(eyeL, eyeR);

      // Left & Right Arms (pivoted at shoulder)
      const armLPivot = new THREE.Group();
      armLPivot.position.set(-0.23, 0.40, 0);
      const armL = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.38, 0.11), skinMat);
      armL.position.set(0, -0.16, 0);
      armLPivot.add(armL);
      torsoPivot.add(armLPivot);

      const armRPivot = new THREE.Group();
      armRPivot.position.set(0.23, 0.40, 0);
      const armR = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.38, 0.11), skinMat);
      armR.position.set(0, -0.16, 0);
      armRPivot.add(armR);
      torsoPivot.add(armRPivot);

      // Food skewer (烤魚/烤山豬肉串) held in left hand during DUSK feast (回家吃飯時顯示!)
      const foodSkewer = new THREE.Group();
      foodSkewer.position.set(0, -0.32, 0.16);
      const stickMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, 0.03, 0.36),
        new THREE.MeshLambertMaterial({ color: 0x78350f })
      );
      const meatMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.12, 0.20),
        new THREE.MeshLambertMaterial({ color: isFemale ? 0x38bdf8 : 0xd97706 })
      );
      meatMesh.position.set(0, 0.02, 0.08);
      foodSkewer.add(stickMesh, meatMesh);
      foodSkewer.visible = false;
      armLPivot.add(foodSkewer);

      // Left & Right Legs (pivoted at hip)
      const legLPivot = new THREE.Group();
      legLPivot.position.set(-0.09, isSeated ? 0.28 : 0.48, 0);
      const legL = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.46, 0.13), skinMat);
      legL.position.set(0, -0.23, 0);
      legLPivot.add(legL);
      root.add(legLPivot);

      const legRPivot = new THREE.Group();
      legRPivot.position.set(0.09, isSeated ? 0.28 : 0.48, 0);
      const legR = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.46, 0.13), skinMat);
      legR.position.set(0, -0.23, 0);
      legRPivot.add(legR);
      root.add(legRPivot);

      if (isSeated) {
        legLPivot.rotation.x = -Math.PI * 0.46;
        legRPivot.rotation.x = -Math.PI * 0.46;
        legLPivot.rotation.y = -0.18;
        legRPivot.rotation.y = 0.18;
      }

      tagBiotaHierarchy(root, speciesKey);
      const humanObj = {
        root,
        torsoPivot,
        headGroup,
        armLPivot,
        armRPivot,
        legLPivot,
        legRPivot,
        foodSkewer,
        defaultSeated: isSeated,
        toolMeshes: []
      };
      return humanObj;
    }

    // Helper to register each tribe member's Dusk Dining seat (回家圍火吃飯座位) & Night Cave Sleeping mat (夜晚入洞睡覺草蓆位)
    function registerTribeRoutine(humanObj, workLocalPos, workRotY, dineLocalPos, dineRotY, sleepLocalPos, sleepRotY, isNightSentinel = false) {
      humanObj.workLocalPos = workLocalPos.clone();
      humanObj.workRotY = workRotY;
      humanObj.dineLocalPos = dineLocalPos.clone();
      humanObj.dineRotY = dineRotY;
      humanObj.sleepLocalPos = sleepLocalPos.clone();
      humanObj.sleepRotY = sleepRotY;
      humanObj.isNightSentinel = isNightSentinel;
      tribeAnimState.allHumans.push(humanObj);
    }

    // Apply pose helper for Seated Dining (回家圍火吃飯) vs. Lying Down Sleeping in Cave (入洞躺平睡覺) vs. Working
    function applyHumanRoutineTransform(h, mode, idx) {
      if (mode === 'DINE') {
        // Sit in a warm circle around the Chaoyin Cave Hearth eating roasted fish & boar meat!
        h.root.position.copy(h.dineLocalPos);
        h.root.rotation.set(0, h.dineRotY, 0);
        h.torsoPivot.position.set(0, 0.28, 0);
        h.legLPivot.position.set(-0.09, 0.28, 0);
        h.legRPivot.position.set(0.09, 0.28, 0);
        h.legLPivot.rotation.set(-Math.PI * 0.46, -0.18, 0);
        h.legRPivot.rotation.set(-Math.PI * 0.46, 0.18, 0);

        const eatCycle = (Math.sin(simTime * 3.2 + idx * 1.1) + 1) * 0.5; // 0..1 raising food to mouth
        h.foodSkewer.visible = true;
        h.toolMeshes.forEach(tm => { tm.visible = false; });
        h.armLPivot.rotation.set(-0.75 - eatCycle * 0.72, 0.25, 0);
        h.armRPivot.rotation.set(-0.65 + Math.cos(simTime * 2.5 + idx) * 0.25, -0.15, 0);
        h.torsoPivot.rotation.set(0.10 + eatCycle * 0.08, Math.sin(simTime * 1.5 + idx) * 0.12, 0);
        h.headGroup.rotation.x = eatCycle * 0.18;
        return true;
      }

      if (mode === 'SLEEP') {
        h.foodSkewer.visible = false;
        h.toolMeshes.forEach(tm => { tm.visible = false; });

        if (h.isNightSentinel) {
          // Night-watch elder sits faithfully beside the glowing hearth embers guarding the sleeping tribe!
          h.root.position.copy(h.sleepLocalPos);
          h.root.rotation.set(0, h.sleepRotY, 0);
          h.torsoPivot.position.set(0, 0.28, 0);
          h.legLPivot.position.set(-0.09, 0.28, 0);
          h.legRPivot.position.set(0.09, 0.28, 0);
          h.legLPivot.rotation.set(-Math.PI * 0.46, -0.18, 0);
          h.legRPivot.rotation.set(-Math.PI * 0.46, 0.18, 0);
          const nod = Math.sin(simTime * 1.8);
          h.torsoPivot.rotation.set(0.22 + nod * 0.05, 0, 0);
          h.armLPivot.rotation.set(-0.75, 0.2, 0);
          h.armRPivot.rotation.set(-0.75, -0.2, 0);
          h.headGroup.rotation.x = 0.15 + nod * 0.08;
          return true;
        }

        // Lie down horizontally on the woven bark-cloth sleeping mats inside Chaoyin & Yong'an Caves!
        h.root.position.copy(h.sleepLocalPos);
        // Rotate root so the human lies on their back/side on the sleeping mat
        h.root.rotation.set(-Math.PI * 0.48, h.sleepRotY, 0);
        h.torsoPivot.position.set(0, 0.48, 0);
        const breathe = Math.sin(simTime * 1.6 + idx * 0.9) * 0.05;
        h.torsoPivot.rotation.set(breathe, 0, 0);
        h.legLPivot.position.set(-0.09, 0.48, 0);
        h.legRPivot.position.set(0.09, 0.48, 0);
        h.legLPivot.rotation.set(-0.08, 0, 0);
        h.legRPivot.rotation.set(-0.08, 0, 0);
        h.armLPivot.rotation.set(-0.35, 0.35, 0);
        h.armRPivot.rotation.set(-0.35, -0.35, 0);
        h.headGroup.rotation.x = 0.12;
        return true;
      }

      // Restore WORK mode defaults
      h.foodSkewer.visible = false;
      h.toolMeshes.forEach(tm => { tm.visible = true; });
      h.root.rotation.set(0, h.workRotY, 0);
      h.headGroup.rotation.x = 0;
      const seated = h.defaultSeated;
      h.torsoPivot.position.set(0, seated ? 0.28 : 0.48, 0);
      h.legLPivot.position.set(-0.09, seated ? 0.28 : 0.48, 0);
      h.legRPivot.position.set(0.09, seated ? 0.28 : 0.48, 0);
      if (seated) {
        h.legLPivot.rotation.set(-Math.PI * 0.46, -0.18, 0);
        h.legRPivot.rotation.set(-Math.PI * 0.46, 0.18, 0);
      } else {
        h.legLPivot.rotation.set(0, 0, 0);
        h.legRPivot.rotation.set(0, 0, 0);
      }
      return false;
    }

    // Build a 3D Taiwan Wild Boar (台灣野豬 - 具白色獠牙與剛毛背脊)
    function buildWildBoarMesh() {
      const group = new THREE.Group();
      const furMat   = new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.9 });
      const maneMat  = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.95 });
      const snoutMat = new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.8 });
      const tuskMat  = new THREE.MeshStandardMaterial({ color: 0xfefce8, roughness: 0.3 });

      const body = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.42, 0.78), furMat);
      body.position.set(0, 0.38, 0);
      group.add(body);

      const dorsalMane = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.12, 0.68), maneMat);
      dorsalMane.position.set(0, 0.62, -0.02);
      group.add(dorsalMane);

      const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.32, 0.36), furMat);
      head.position.set(0, 0.42, 0.48);
      group.add(head);

      const snout = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.22), snoutMat);
      snout.position.set(0, 0.35, 0.70);
      group.add(snout);

      // Iconic white curving tusks (台灣山豬白色獠牙) + facial white stripe
      const tuskL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.05), tuskMat);
      tuskL.position.set(-0.13, 0.39, 0.68);
      tuskL.rotation.z = 0.25;
      tuskL.rotation.x = -0.2;
      const tuskR = tuskL.clone();
      tuskR.position.x = 0.13;
      tuskR.rotation.z = -0.25;
      group.add(tuskL, tuskR);

      const stripeL = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.22), tuskMat);
      stripeL.position.set(-0.18, 0.36, 0.54);
      const stripeR = stripeL.clone();
      stripeR.position.x = 0.18;
      group.add(stripeL, stripeR);

      const legs = [];
      [[-0.15, 0.26], [0.15, 0.26], [-0.15, -0.26], [0.15, -0.26]].forEach(([lx, lz]) => {
        const legPivot = new THREE.Group();
        legPivot.position.set(lx, 0.22, lz);
        const legMesh = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.24, 0.11), furMat);
        legMesh.position.set(0, -0.11, 0);
        legPivot.add(legMesh);
        group.add(legPivot);
        legs.push(legPivot);
      });

      tagBiotaHierarchy(group, 'HUMAN_HUNT');
      return { group, legs };
    }

    // Build a 3D Formosan Barking Deer (台灣山羌 - 栗紅毛色與短叉角)
    function buildBarkingDeerMesh() {
      const group = new THREE.Group();
      const coatMat   = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.78 });
      const bellyMat  = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.85 });
      const antlerMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.4 });

      const body = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.30, 0.62), coatMat);
      body.position.set(0, 0.42, 0);
      group.add(body);

      const neck = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.26, 0.18), coatMat);
      neck.position.set(0, 0.58, 0.26);
      neck.rotation.x = 0.25;
      group.add(neck);

      const head = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.18, 0.28), coatMat);
      head.position.set(0, 0.68, 0.38);
      group.add(head);

      const earL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.05), coatMat);
      earL.position.set(-0.10, 0.79, 0.30);
      earL.rotation.z = 0.35;
      const earR = earL.clone();
      earR.position.x = 0.10;
      earR.rotation.z = -0.35;
      group.add(earL, earR);

      const antlerL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.04), antlerMat);
      antlerL.position.set(-0.05, 0.81, 0.34);
      const antlerR = antlerL.clone();
      antlerR.position.x = 0.05;
      group.add(antlerL, antlerR);

      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.10, 0.08), bellyMat);
      tail.position.set(0, 0.48, -0.33);
      group.add(tail);

      const legs = [];
      [[-0.11, 0.22], [0.11, 0.22], [-0.11, -0.22], [0.11, -0.22]].forEach(([lx, lz]) => {
        const legPivot = new THREE.Group();
        legPivot.position.set(lx, 0.30, lz);
        const legMesh = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.30, 0.07), coatMat);
        legMesh.position.set(0, -0.15, 0);
        legPivot.add(legMesh);
        group.add(legPivot);
        legs.push(legPivot);
      });

      tagBiotaHierarchy(group, 'HUMAN_HUNT');
      return { group, legs };
    }

    // Create floating "💤 Zzz" sprite for nighttime cave sleeping
    function createSleepZzzSprite(x, y, z) {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.strokeStyle = '#818cf8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(8, 8, 112, 48, 12);
      } else {
        ctx.rect(8, 8, 112, 48);
      }
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#e0e7ff';
      ctx.font = '900 24px "Noto Sans TC", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('💤 Zzz', 64, 41);

      const tex = new THREE.CanvasTexture(canvas);
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
      const sprite = new THREE.Sprite(mat);
      sprite.position.set(x, y, z);
      sprite.scale.set(2.8, 1.4, 1);
      sprite.visible = false;
      tribeGroup.add(sprite);
      return { sprite, baseX: x, baseY: y, baseZ: z };
    }

    function initPrehistoricTribe() {
      const groundMidY = 5.5;   // Middle terrace in front of Chaoyin & Yong'an Caves (surfaceY = 5 -> top = 5.5)
      const groundLowY = 3.5;   // Lower cobble knapping terrace (surfaceY = 3 -> top = 3.5)

      const stoneMat  = new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.9 });
      const cobbleMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.85 });
      const woodMat   = new THREE.MeshStandardMaterial({ color: 0x713f12, roughness: 0.88 });
      const barkMat   = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.8 });
      const vineMat   = new THREE.MeshStandardMaterial({ color: 0x65a30d, roughness: 0.75 });
      const boneMat   = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.35 });
      const matWeave  = new THREE.MeshStandardMaterial({ color: 0xa16207, roughness: 0.92 });

      // -----------------------------------------------------------------------
      // 0. 🌙 八仙洞穴內部睡眠草蓆、洞穴松明火把照明與 Zzz 睡眠氣泡 (潮音洞 & 永安洞)
      // -----------------------------------------------------------------------
      const sleepingMatCoords = [
        // 潮音洞內草蓆 (Z = 3.3 .. 6.7, X = -16.2 .. -14.5, Y = 5.53)
        [-16.1, 5.53, 3.6], [-16.1, 5.53, 4.9], [-16.1, 5.53, 6.2],
        [-14.9, 5.53, 3.6], [-14.9, 5.53, 6.2],
        // 永安洞內草蓆 (Z = -1.7 .. 0.8, X = -15.6 .. -14.4, Y = 5.53)
        [-15.5, 5.53, -1.4], [-15.5, 5.53, -0.2], [-15.5, 5.53, 0.8]
      ];
      sleepingMatCoords.forEach(([mx, my, mz]) => {
        const sleepMat = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.05, 0.72), matWeave);
        sleepMat.position.set(mx, my, mz);
        tribeGroup.add(sleepMat);
      });

      // Warm Cave Interior PointLights so the caves glow invitingly at night!
      const caveLight1 = new THREE.PointLight(0xff922b, 1.2, 12, 1.4);
      caveLight1.position.set(-15.2, 7.2, 5.0);
      const caveLight2 = new THREE.PointLight(0xff922b, 1.0, 10, 1.4);
      caveLight2.position.set(-15.0, 7.0, -0.4);
      tribeGroup.add(caveLight1, caveLight2);
      tribeAnimState.caveInteriorLight1 = caveLight1;
      tribeAnimState.caveInteriorLight2 = caveLight2;

      // -----------------------------------------------------------------------
      // 1. 🔥 焚火與烤食 (HUMAN_FIRE) at (-11.2, 5.5, 5.0) in front of 潮音洞
      // -----------------------------------------------------------------------
      const fireStation = new THREE.Group();
      fireStation.position.set(-11.2, groundMidY, 5.0);
      tribeGroup.add(fireStation);
      tribeAnimState.fireGroup = fireStation;

      // Stone hearth ring (圓礫石圈火塘)
      for (let i = 0; i < 10; i++) {
        const ang = (i / 10) * Math.PI * 2;
        const st = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.18, 0.24), cobbleMat);
        st.position.set(Math.cos(ang) * 0.62, 0.09, Math.sin(ang) * 0.62);
        st.rotation.y = ang;
        fireStation.add(st);
      }
      // Crossed firewood logs inside hearth
      for (let i = 0; i < 4; i++) {
        const log = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.95), woodMat);
        log.position.set(0, 0.12, 0);
        log.rotation.y = (i * Math.PI) / 4;
        log.rotation.x = 0.18;
        fireStation.add(log);
      }

      // Multi-layered flickering 3D flames (外焰、中焰、高溫火芯)
      const flameColors = [0xea580c, 0xf97316, 0xfacc15, 0xfef08a];
      for (let i = 0; i < 5; i++) {
        const fMat = new THREE.MeshBasicMaterial({ color: flameColors[i % flameColors.length] });
        const fMesh = new THREE.Mesh(new THREE.ConeGeometry(0.28 - i * 0.03, 0.82 + (i % 2) * 0.25, 5), fMat);
        fMesh.position.set((i - 2) * 0.08, 0.42 + i * 0.05, ((i % 3) - 1) * 0.08);
        fireStation.add(fMesh);
        tribeAnimState.flames.push({ mesh: fMesh, phase: i * 1.3, baseH: 0.42 + i * 0.05 });
      }

      // Rising smoke puffs (裊裊炊煙粒子)
      const smokeMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.42 });
      for (let i = 0; i < 6; i++) {
        const sm = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.24), smokeMat);
        sm.position.set(0, 1.0 + i * 0.45, 0);
        fireStation.add(sm);
        tribeAnimState.smokeParticles.push({ mesh: sm, progress: i / 6 });
      }

      // Warm campfire PointLight illuminating the cave mouth & humans
      const fireLight = new THREE.PointLight(0xff7b00, 2.4, 18, 1.4);
      fireLight.position.set(0, 1.2, 0);
      fireStation.add(fireLight);
      tribeAnimState.fireLight = fireLight;

      // Wooden A-frame roasting rack with skewered fish & wild boar meat
      const rackPostL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.95, 0.08), woodMat);
      rackPostL.position.set(-0.55, 0.45, -0.25);
      const rackPostR = rackPostL.clone();
      rackPostR.position.set(0.55, 0.45, -0.25);
      const rackBar = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.06, 0.06), woodMat);
      rackBar.position.set(0, 0.86, -0.25);
      const roastMeat = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.22, 0.22),
        new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.6 })
      );
      roastMeat.position.set(0, 0.86, -0.25);
      fireStation.add(rackPostL, rackPostR, rackBar, roastMeat);
      tribeAnimState.roastRackMeat = roastMeat;

      // Human 1A: Seated fire-tender & Night Sentinel (守火長者：夜晚留守火塘邊看顧火種)
      const tenderA = buildPrehistoricHumanMesh({ speciesKey: 'HUMAN_FIRE', isSeated: true, tunicColor: 0x9a3412 });
      const pokeStick = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.72), woodMat);
      pokeStick.position.set(0, -0.32, 0.30);
      tenderA.armRPivot.add(pokeStick);
      tenderA.toolMeshes.push(pokeStick);
      fireStation.add(tenderA.root);
      tribeAnimState.fireTenderA = tenderA;
      registerTribeRoutine(
        tenderA,
        new THREE.Vector3(-1.05, 0, 0.35), 1.25,
        new THREE.Vector3(-1.25, 0, 0.35), 1.30,
        new THREE.Vector3(-1.15, 0, 0.15), 1.40,
        true // Night Sentinel!
      );

      // Human 1B: Standing cook turning the roasted fish/meat
      const tenderB = buildPrehistoricHumanMesh({ speciesKey: 'HUMAN_FIRE', isSeated: false, tunicColor: 0xa16207 });
      fireStation.add(tenderB.root);
      tribeAnimState.fireTenderB = tenderB;
      registerTribeRoutine(
        tenderB,
        new THREE.Vector3(0.95, 0, -0.45), -2.1,
        new THREE.Vector3(1.15, 0, -0.55), -2.1,
        new THREE.Vector3(-4.8, 0.08, -1.4), Math.PI * 0.5
      );

      tagBiotaHierarchy(fireStation, 'HUMAN_FIRE');

      // -----------------------------------------------------------------------
      // 2. 🪵 採集木頭與漂流木 (HUMAN_WOOD) at (-10.8, 5.5, -1.6) near 永安洞
      // -----------------------------------------------------------------------
      const woodStation = new THREE.Group();
      woodStation.position.set(-10.8, groundMidY, -1.6);
      tribeGroup.add(woodStation);

      // Stacked firewood pile at cave entrance
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3 - row; col++) {
          const logMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.20, 1.15), woodMat);
          logMesh.position.set(-1.3 + col * 0.25 + row * 0.12, 0.11 + row * 0.19, -0.4);
          woodStation.add(logMesh);
        }
      }

      // Scattered branches on the terrace ground
      for (let i = 0; i < 4; i++) {
        const br = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.08, 0.65), woodMat);
        br.position.set(0.5 + (i % 2) * 0.4, 0.05, 0.3 + i * 0.22);
        br.rotation.y = i * 0.7;
        woodStation.add(br);
      }

      // Human 2A: Bending down to pick up branches
      const gathererA = buildPrehistoricHumanMesh({ speciesKey: 'HUMAN_WOOD', isSeated: false, tunicColor: 0x78350f });
      const heldBranch = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.09, 0.09), woodMat);
      heldBranch.position.set(0.18, -0.34, 0.15);
      gathererA.armRPivot.add(heldBranch);
      gathererA.toolMeshes.push(heldBranch);
      woodStation.add(gathererA.root);
      tribeAnimState.woodGathererA = gathererA;
      registerTribeRoutine(
        gathererA,
        new THREE.Vector3(0.35, 0, 0.45), 0.4,
        new THREE.Vector3(-1.35, 0, 5.4), 0.85,
        new THREE.Vector3(-4.6, 0.08, 0.2), Math.PI * 0.5
      );

      // Human 2B: Carrying a heavy driftwood log on shoulder back and forth
      const carrierB = buildPrehistoricHumanMesh({ speciesKey: 'HUMAN_WOOD', isSeated: false, tunicColor: 0x854d0e });
      const shoulderLog = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 1.45), woodMat);
      shoulderLog.position.set(0.22, 0.46, 0.05);
      carrierB.torsoPivot.add(shoulderLog);
      carrierB.toolMeshes.push(shoulderLog);
      woodStation.add(carrierB.root);
      tribeAnimState.woodCarrierB = carrierB;
      registerTribeRoutine(
        carrierB,
        new THREE.Vector3(1.6, 0, -0.35), Math.PI * 0.5,
        new THREE.Vector3(0.45, 0, 5.2), -1.1,
        new THREE.Vector3(-4.6, 0.08, 1.4), Math.PI * 0.5
      );

      tagBiotaHierarchy(woodStation, 'HUMAN_WOOD');

      // -----------------------------------------------------------------------
      // 3. 🧶 編織黃藤繩與打擊樹皮製衣 (HUMAN_BARK_VINE) at (-9.2, 5.5, 1.6)
      // -----------------------------------------------------------------------
      const craftStation = new THREE.Group();
      craftStation.position.set(-9.2, groundMidY, 1.6);
      tribeGroup.add(craftStation);

      // Flat Andesite Stone Anvil (安山岩石砧) + Stretched Bark Cloth Sheet (構樹皮布)
      const stoneAnvil = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.34, 0.62), stoneMat);
      stoneAnvil.position.set(-0.55, 0.17, 0);
      craftStation.add(stoneAnvil);

      const barkSheet = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.06, 0.48), barkMat);
      barkSheet.position.set(-0.55, 0.37, 0);
      craftStation.add(barkSheet);
      tribeAnimState.barkClothSheet = barkSheet;

      // Human 3A: Beating bark cloth with a stone bark-beater (石製樹皮布打棒)
      const barkHuman = buildPrehistoricHumanMesh({ speciesKey: 'HUMAN_BARK_VINE', isSeated: true, isFemale: true, tunicColor: 0xd97706 });
      const stoneBeater = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.42), cobbleMat);
      stoneBeater.position.set(0, -0.34, 0.18);
      barkHuman.armRPivot.add(stoneBeater);
      barkHuman.toolMeshes.push(stoneBeater);
      craftStation.add(barkHuman.root);
      tribeAnimState.barkBeaterHuman = barkHuman;
      registerTribeRoutine(
        barkHuman,
        new THREE.Vector3(-0.55, 0, -0.68), 0,
        new THREE.Vector3(-1.95, 0, 1.95), 0.15,
        new THREE.Vector3(-6.2, 0.08, -1.8), Math.PI * 0.5
      );

      // Rattan Vine Rope Frame & Coils (黃藤編繩架與藤圈)
      const vinePost = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.85, 0.10), woodMat);
      vinePost.position.set(0.85, 0.42, 0.35);
      craftStation.add(vinePost);

      const vineRopeStrand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.92), vineMat);
      vineRopeStrand.position.set(0.85, 0.52, -0.10);
      vineRopeStrand.rotation.x = 0.22;
      craftStation.add(vineRopeStrand);
      tribeAnimState.vineRopeCoil = vineRopeStrand;

      // Human 3B: Twisting & braiding rattan vine rope (揉捻編織黃藤繩)
      const vineHuman = buildPrehistoricHumanMesh({ speciesKey: 'HUMAN_BARK_VINE', isSeated: true, tunicColor: 0x65a30d });
      craftStation.add(vineHuman.root);
      tribeAnimState.vineWeaverHuman = vineHuman;
      registerTribeRoutine(
        vineHuman,
        new THREE.Vector3(0.85, 0, -0.65), 0,
        new THREE.Vector3(-0.75, 0, 2.15), -0.65,
        new THREE.Vector3(-6.2, 0.08, -0.8), Math.PI * 0.5
      );

      tagBiotaHierarchy(craftStation, 'HUMAN_BARK_VINE');

      // -----------------------------------------------------------------------
      // 4. 🪨 敲擊石頭製作工具 (HUMAN_STONE) at (-4.5, 3.5, 4.5) on Lower Cobble Terrace
      // -----------------------------------------------------------------------
      const stoneStation = new THREE.Group();
      stoneStation.position.set(-4.5, groundLowY, 4.5);
      tribeGroup.add(stoneStation);

      // Central boulder anvil & pile of rounded cobble cores + chipped pebble choppers
      const anvilBoulder = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.36, 0.55), stoneMat);
      anvilBoulder.position.set(0, 0.18, 0);
      stoneStation.add(anvilBoulder);

      for (let i = 0; i < 7; i++) {
        const cob = new THREE.Mesh(
          new THREE.BoxGeometry(0.24, 0.16, 0.28),
          i % 2 === 0 ? cobbleMat : stoneMat
        );
        const ang = (i / 7) * Math.PI * 2;
        cob.position.set(Math.cos(ang) * 0.58, 0.08, Math.sin(ang) * 0.58);
        cob.rotation.y = i * 1.1;
        stoneStation.add(cob);
      }

      // Sparks & flying stone flakes when hammerstone strikes the core!
      const sparkMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
      const flakeMat = new THREE.MeshStandardMaterial({ color: 0xa8a29e, roughness: 0.6 });
      for (let i = 0; i < 8; i++) {
        const spMesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.08, 0.08),
          i < 5 ? sparkMat : flakeMat
        );
        spMesh.position.set(0, 0.42, 0);
        stoneStation.add(spMesh);
        tribeAnimState.knapSparks.push({
          mesh: spMesh,
          vx: (Math.random() - 0.5) * 2.4,
          vy: 1.5 + Math.random() * 1.8,
          vz: (Math.random() - 0.5) * 2.4
        });
      }

      // Human 4A: Master stone knapper striking core with hammerstone
      const knapperA = buildPrehistoricHumanMesh({ speciesKey: 'HUMAN_STONE', isSeated: true, tunicColor: 0x57534e });
      const hammerStone = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.22), cobbleMat);
      hammerStone.position.set(0, -0.34, 0.10);
      knapperA.armRPivot.add(hammerStone);
      const coreStone = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.24), stoneMat);
      coreStone.position.set(0, -0.32, 0.12);
      knapperA.armLPivot.add(coreStone);
      knapperA.toolMeshes.push(hammerStone, coreStone);
      stoneStation.add(knapperA.root);
      tribeAnimState.stoneKnapperA = knapperA;
      // Note: stoneStation is at (-4.5, 3.5, 4.5), so relative to stoneStation, Chaoyin Cave hearth (-11.2, 5.5, 5.0) is (-6.7, +2.0, +0.5)
      registerTribeRoutine(
        knapperA,
        new THREE.Vector3(-0.75, 0, 0), Math.PI * 0.5,
        new THREE.Vector3(-5.4, 2.0, 1.3), -1.8,
        new THREE.Vector3(-11.4, 2.08, -0.8), Math.PI * 0.5
      );

      // Human 4B: Second toolmaker inspecting & retouching a sharp flake tool
      const knapperB = buildPrehistoricHumanMesh({ speciesKey: 'HUMAN_STONE', isSeated: true, tunicColor: 0x78716c });
      const chopperTool = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.14, 0.26), cobbleMat);
      chopperTool.position.set(0, -0.32, 0.12);
      knapperB.armRPivot.add(chopperTool);
      knapperB.toolMeshes.push(chopperTool);
      stoneStation.add(knapperB.root);
      tribeAnimState.stoneKnapperB = knapperB;
      registerTribeRoutine(
        knapperB,
        new THREE.Vector3(0.75, 0, 0.25), -Math.PI * 0.55,
        new THREE.Vector3(-6.2, 2.0, 1.85), -2.6,
        new THREE.Vector3(-11.4, 2.08, 0.4), Math.PI * 0.5
      );

      tagBiotaHierarchy(stoneStation, 'HUMAN_STONE');

      // -----------------------------------------------------------------------
      // 5. 🐗 穴居地周邊廣域巡迴狩獵 (HUMAN_HUNT) — 橫跨八仙洞周圍各層海階與林緣！
      // -----------------------------------------------------------------------
      // Placed at world origin (0,0,0) so the boar, deer, and hunters roam freely across all terraces around the caves!
      const huntWorldGroup = new THREE.Group();
      tribeGroup.add(huntWorldGroup);

      const wildBoar = buildWildBoarMesh();
      wildBoar.group.scale.setScalar(1.22);
      huntWorldGroup.add(wildBoar.group);
      tribeAnimState.wildBoar = wildBoar;

      const barkingDeer = buildBarkingDeerMesh();
      barkingDeer.group.scale.setScalar(1.22);
      huntWorldGroup.add(barkingDeer.group);
      tribeAnimState.barkingDeer = barkingDeer;

      // Male Hunter 5A pursuing the Wild Boar across the settlement terraces
      const hunterA = buildPrehistoricHumanMesh({ speciesKey: 'HUMAN_HUNT', isSeated: false, tunicColor: 0x713f12, bandColor: 0xef4444, scale: 1.12 });
      const spearShaftA = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.75), woodMat);
      spearShaftA.position.set(0, -0.32, 0.48);
      const spearTipA = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.30, 4), stoneMat);
      spearTipA.rotation.x = Math.PI * 0.5;
      spearTipA.position.set(0, -0.32, 1.42);
      hunterA.armRPivot.add(spearShaftA, spearTipA);
      hunterA.toolMeshes.push(spearShaftA, spearTipA);
      huntWorldGroup.add(hunterA.root);
      tribeAnimState.hunterA = hunterA;
      registerTribeRoutine(
        hunterA,
        new THREE.Vector3(-12, 5.5, 3), 0,
        new THREE.Vector3(-12.3, 5.5, 6.2), 2.35,
        new THREE.Vector3(-16.1, 5.58, 4.9), Math.PI * 0.5
      );

      // Male Hunter 5B pursuing the Barking Deer across the settlement terraces
      const hunterB = buildPrehistoricHumanMesh({ speciesKey: 'HUMAN_HUNT', isSeated: false, tunicColor: 0x3f6212, bandColor: 0xfacc15, scale: 1.12 });
      const spearShaftB = spearShaftA.clone();
      const spearTipB = spearTipA.clone();
      hunterB.armRPivot.add(spearShaftB, spearTipB);
      hunterB.toolMeshes.push(spearShaftB, spearTipB);
      huntWorldGroup.add(hunterB.root);
      tribeAnimState.hunterB = hunterB;
      registerTribeRoutine(
        hunterB,
        new THREE.Vector3(-9, 5.5, 6), 0,
        new THREE.Vector3(-10.1, 5.5, 6.3), -2.4,
        new THREE.Vector3(-16.1, 5.58, 6.2), Math.PI * 0.5
      );

      // Male Hunter 5C flanking from the outer terrace slope
      const hunterC = buildPrehistoricHumanMesh({ speciesKey: 'HUMAN_HUNT', isSeated: false, tunicColor: 0x9a3412, bandColor: 0xf97316, scale: 1.12 });
      const spearShaftC = spearShaftA.clone();
      const spearTipC = spearTipA.clone();
      hunterC.armRPivot.add(spearShaftC, spearTipC);
      hunterC.toolMeshes.push(spearShaftC, spearTipC);
      huntWorldGroup.add(hunterC.root);
      tribeAnimState.hunterC = hunterC;
      registerTribeRoutine(
        hunterC,
        new THREE.Vector3(-15, 11.5, 3.5), 0,
        new THREE.Vector3(-12.6, 5.5, 4.2), 1.15,
        new THREE.Vector3(-14.9, 5.58, 6.2), Math.PI * 0.5
      );

      tagBiotaHierarchy(huntWorldGroup, 'HUMAN_HUNT');

      // -----------------------------------------------------------------------
      // 6. 🐚 海邊女性採集海菜與海產貝類 (HUMAN_FORAGE) along Intertidal Shore (X=+2..+6.5, Z=-2..+9)
      // -----------------------------------------------------------------------
      const forageWorldGroup = new THREE.Group();
      tribeGroup.add(forageWorldGroup);

      // Rich intertidal seaweed patches & shellfish clusters along the wet reef rocks for the women to harvest
      const ulvaPatchMat = new THREE.MeshLambertMaterial({ color: 0x22c55e });
      const shellPatchMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.4 });
      [
        [2.6, -1.2], [3.8, 0.8], [4.8, 2.5], [3.2, 4.2], [5.4, 7.6], [2.8, 8.8]
      ].forEach(([fx, fz], idx) => {
        const fy = getSmoothGroundY(fx, fz);
        const patch = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.42), ulvaPatchMat);
        patch.position.set(fx, fy + 0.04, fz);
        const shell = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.16), shellPatchMat);
        shell.position.set(fx + 0.18, fy + 0.08, fz + 0.12);
        forageWorldGroup.add(patch, shell);
      });

      const womenConfigs = [
        {
          tunicColor: 0xbe185d, bandColor: 0xfef08a,
          centerX: 3.1, centerZ: 0.5, rx: 0.9, rz: 2.2, phase: 0.0,
          dinePos: new THREE.Vector3(-9.9, 5.5, 5.6), dineRot: -1.9,
          sleepPos: new THREE.Vector3(-15.5, 5.58, -1.4)
        },
        {
          tunicColor: 0x0f766e, bandColor: 0xfbcfe8,
          centerX: 4.4, centerZ: 3.6, rx: 1.1, rz: 1.8, phase: 2.1,
          dinePos: new THREE.Vector3(-10.1, 5.5, 3.8), dineRot: -0.9,
          sleepPos: new THREE.Vector3(-15.5, 5.58, -0.2)
        },
        {
          tunicColor: 0xb45309, bandColor: 0xa7f3d0,
          centerX: 3.5, centerZ: 8.2, rx: 0.85, rz: 1.5, phase: 4.2,
          dinePos: new THREE.Vector3(-11.4, 5.5, 3.5), dineRot: 0.1,
          sleepPos: new THREE.Vector3(-15.5, 5.58, 0.8)
        },
        {
          // 4th Forager at Sanxiantai Tombolo: crosses the exposed cobble land-bridge to Sanxiantai Island at LOW TIDE!
          tunicColor: 0x9333ea, bandColor: 0xfde047,
          centerX: 2.2, centerZ: 12.6, rx: 0.75, rz: 1.2, phase: 1.2,
          isTomboloWalker: true,
          dinePos: new THREE.Vector3(-10.6, 5.5, 6.2), dineRot: -2.6,
          sleepPos: new THREE.Vector3(-16.1, 5.58, -0.8)
        }
      ];

      womenConfigs.forEach(cfg => {
        const woman = buildPrehistoricHumanMesh({
          speciesKey: 'HUMAN_FORAGE',
          isFemale: true,
          hasBackBasket: true,
          isSeated: false,
          tunicColor: cfg.tunicColor,
          bandColor: cfg.bandColor,
          scale: 1.06
        });
        // Stone/shell scraper in right hand + harvested green Ulva seaweed in left hand
        const shellScraper = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.22), boneMat);
        shellScraper.position.set(0, -0.34, 0.12);
        woman.armRPivot.add(shellScraper);

        const heldSeaweed = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.24, 0.12), ulvaPatchMat);
        heldSeaweed.position.set(0, -0.34, 0.12);
        woman.armLPivot.add(heldSeaweed);
        woman.toolMeshes.push(shellScraper, heldSeaweed);

        forageWorldGroup.add(woman.root);
        tribeAnimState.foragerWomen.push({ human: woman, cfg });
        registerTribeRoutine(
          woman,
          new THREE.Vector3(cfg.centerX, 1.5, cfg.centerZ), 0,
          cfg.dinePos, cfg.dineRot,
          cfg.sleepPos, Math.PI * 0.5
        );
      });

      tagBiotaHierarchy(forageWorldGroup, 'HUMAN_FORAGE');

      // -----------------------------------------------------------------------
      // 7. 🛶 男性捕魚：木拼舢舨近海捕撈 & 岸邊骨鉤垂釣 (HUMAN_FISH)
      // -----------------------------------------------------------------------
      // 7A. Offshore Wooden Plank Sampan / Bamboo-Wood Raft (木拼舢舨)
      const sampanGroup = new THREE.Group();
      sampanGroup.position.set(9.5, seaLevel + 0.15, 5.5);
      tribeGroup.add(sampanGroup);
      tribeAnimState.sampanBoat = sampanGroup;

      for (let i = -2; i <= 2; i++) {
        const plank = new THREE.Mesh(
          new THREE.BoxGeometry(0.32, 0.16, 3.1 - Math.abs(i) * 0.18),
          i % 2 === 0 ? woodMat : barkMat
        );
        plank.position.set(i * 0.34, 0.08, 0);
        sampanGroup.add(plank);

        const bowProw = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.16, 0.55), woodMat);
        bowProw.position.set(i * 0.34, 0.20, 1.55 - Math.abs(i) * 0.08);
        bowProw.rotation.x = -0.35;
        sampanGroup.add(bowProw);
      }
      [-0.95, 0, 0.95].forEach(bz => {
        const beam = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.10, 0.14), vineMat);
        beam.position.set(0, 0.18, bz);
        sampanGroup.add(beam);
      });
      const fishBasket = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.28, 0.52), barkMat);
      fishBasket.position.set(0, 0.28, 0.15);
      sampanGroup.add(fishBasket);

      // Male Fisher 7A (Stern): Paddling the wooden sampan during DAY, walks to cave hearth at DUSK & sleeps in cave at NIGHT!
      const paddler = buildPrehistoricHumanMesh({ speciesKey: 'HUMAN_FISH', isSeated: true, tunicColor: 0x0369a1 });
      const oarShaft = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.55), woodMat);
      oarShaft.position.set(-0.22, -0.25, 0.35);
      oarShaft.rotation.y = 0.35;
      oarShaft.rotation.x = 0.65;
      const oarBlade = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.45), barkMat);
      oarBlade.position.set(-0.42, -0.68, 0.85);
      oarBlade.rotation.x = 0.65;
      paddler.armLPivot.add(oarShaft, oarBlade);
      paddler.toolMeshes.push(oarShaft, oarBlade);
      tribeGroup.add(paddler.root);
      tribeAnimState.sampanPaddler = paddler;
      registerTribeRoutine(
        paddler,
        new THREE.Vector3(9.25, 0.3, 4.65), 0,
        new THREE.Vector3(-12.2, 5.5, 3.8), 0.75,
        new THREE.Vector3(-16.1, 5.58, 3.6), Math.PI * 0.5
      );

      // Male Fisher 7B (Bow): Standing at the bow thrusting a barbed bone harpoon
      const harpooner = buildPrehistoricHumanMesh({ speciesKey: 'HUMAN_FISH', isSeated: false, tunicColor: 0x0284c7 });
      const harpoonPole = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.85), woodMat);
      harpoonPole.position.set(0, -0.30, 0.45);
      harpoonPole.rotation.x = 0.45;
      const boneHarpoonHead = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.32, 4), boneMat);
      boneHarpoonHead.rotation.x = Math.PI * 0.5 + 0.45;
      boneHarpoonHead.position.set(0, -0.68, 1.25);
      harpooner.armRPivot.add(harpoonPole, boneHarpoonHead);
      harpooner.toolMeshes.push(harpoonPole, boneHarpoonHead);
      tribeGroup.add(harpooner.root);
      tribeAnimState.sampanHarpooner = harpooner;
      registerTribeRoutine(
        harpooner,
        new THREE.Vector3(9.65, 0.3, 6.45), 0.25,
        new THREE.Vector3(-11.1, 5.5, 6.4), 3.1,
        new THREE.Vector3(-14.9, 5.58, 3.6), Math.PI * 0.5
      );

      tagBiotaHierarchy(sampanGroup, 'HUMAN_FISH');

      // 7B. Shoreline Angling on the Intertidal Reef Outcrop (岸邊骨鉤垂釣) at (4.5, 1.5, 6.0)
      const anglerStation = new THREE.Group();
      anglerStation.position.set(4.5, 1.5, 6.0);
      tribeGroup.add(anglerStation);

      const angler = buildPrehistoricHumanMesh({ speciesKey: 'HUMAN_FISH', isSeated: false, tunicColor: 0x0e7490 });
      anglerStation.add(angler.root);
      tribeAnimState.shoreAngler = angler;

      const rodGroup = new THREE.Group();
      rodGroup.position.set(0, -0.32, 0.12);
      const bambooMat = new THREE.MeshStandardMaterial({ color: 0x84cc16, roughness: 0.6 });
      const rodSeg1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.15), bambooMat);
      rodSeg1.position.set(0, 0.18, 0.55);
      rodSeg1.rotation.x = -0.32;
      const rodSeg2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 1.10), bambooMat);
      rodSeg2.position.set(0, 0.45, 1.58);
      rodSeg2.rotation.x = -0.15;
      const rodTip = new THREE.Group();
      rodTip.position.set(0, 0.58, 2.12);
      rodGroup.add(rodSeg1, rodSeg2, rodTip);
      angler.armRPivot.add(rodGroup);
      angler.toolMeshes.push(rodGroup);
      tribeAnimState.fishingRodGroup = rodGroup;
      tribeAnimState.fishingRodTip = rodTip;

      // Relative to anglerStation (4.5, 1.5, 6.0), Chaoyin Cave hearth (-11.2, 5.5, 5.0) is (-15.7, +4.0, -1.0)
      registerTribeRoutine(
        angler,
        new THREE.Vector3(0, 0, 0), Math.PI * 0.48,
        new THREE.Vector3(-14.3, 4.0, -1.2), -1.65,
        new THREE.Vector3(-19.4, 4.08, -1.1), Math.PI * 0.5
      );

      const hookedFishGroup = new THREE.Group();
      hookedFishGroup.position.set(2.3, -1.2, 0.0);
      const fishBody = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.24, 0.48),
        new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.3, metalness: 0.2 })
      );
      const boneHook = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.08), boneMat);
      boneHook.position.set(0, 0.16, 0.22);
      hookedFishGroup.add(fishBody, boneHook);
      anglerStation.add(hookedFishGroup);
      tribeAnimState.hookedFish = hookedFishGroup;

      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 1.5, 0),
        new THREE.Vector3(2.3, 0, 0)
      ]);
      const fishingLine = new THREE.Line(
        lineGeo,
        new THREE.LineBasicMaterial({ color: 0xfef9c3 })
      );
      anglerStation.add(fishingLine);
      tribeAnimState.fishingLine = fishingLine;

      tagBiotaHierarchy(anglerStation, 'HUMAN_FISH');
    }

    function updatePrehistoricTribe(dt) {
      tribeGroup.visible = currentSliceZ >= 2;
      if (!tribeGroup.visible) return;

      // Optional Automatic Day-Night Cycle (every 18 seconds advances phase: NOON -> DUSK -> NIGHT -> DAWN)
      if (autoDayNightCycle) {
        autoDayNightTimer += dt;
        if (autoDayNightTimer > 18.0) {
          autoDayNightTimer = 0;
          const order = ['NOON', 'DUSK', 'NIGHT', 'DAWN'];
          const nextIdx = (order.indexOf(currentTimeOfDay) + 1) % order.length;
          setTimeOfDay(order[nextIdx], false);
        }
      }

      // Determine current tribe routine mode from Time of Day:
      // NOON & DAWN => 'WORK' (分頭狩獵/海邊採海菜/捕魚/打石/採木)
      // DUSK        => 'DINE' (全族回家圍火吃飯)
      // NIGHT       => 'SLEEP' (星空夜景・全族進入海蝕洞草蓆睡覺)
      const routineMode = (currentTimeOfDay === 'DUSK')
        ? 'DINE'
        : (currentTimeOfDay === 'NIGHT' ? 'SLEEP' : 'WORK');

      // 0. Update Hearth Fire, Cave Interior Lights, and Nighttime Zzz Bubbles
      const fireScaleBoost = (routineMode === 'DINE') ? 1.35 : (routineMode === 'SLEEP' ? 0.65 : 1.0);
      tribeAnimState.flames.forEach((f, idx) => {
        const flicker = Math.sin(simTime * (9.5 + idx * 2.1) + f.phase);
        f.mesh.scale.set(
          (1.0 + flicker * 0.16) * fireScaleBoost,
          (1.0 + Math.cos(simTime * 11.0 + f.phase) * 0.24) * fireScaleBoost,
          (1.0 - flicker * 0.14) * fireScaleBoost
        );
        f.mesh.rotation.y = simTime * 1.5 + idx;
      });
      tribeAnimState.smokeParticles.forEach(sm => {
        sm.progress = (sm.progress + dt * 0.38) % 1.0;
        const p = sm.progress;
        sm.mesh.position.set(
          Math.sin(simTime * 2.0 + p * 5.0) * 0.22 * p,
          0.95 + p * 2.6,
          Math.cos(simTime * 1.6 + p * 4.0) * 0.18 * p
        );
        const s = (0.65 + p * 1.45) * (routineMode === 'SLEEP' ? 0.5 : 1.0);
        sm.mesh.scale.set(s, s, s);
      });
      if (tribeAnimState.fireLight) {
        const baseIntensity = (routineMode === 'DINE') ? 3.2 : (routineMode === 'SLEEP' ? 2.4 : 2.0);
        tribeAnimState.fireLight.intensity = baseIntensity + Math.sin(simTime * 13.0) * 0.35;
      }
      if (tribeAnimState.caveInteriorLight1 && tribeAnimState.caveInteriorLight2) {
        const caveGlow = (routineMode === 'SLEEP') ? 2.8 : (routineMode === 'DINE' ? 2.0 : 0.8);
        tribeAnimState.caveInteriorLight1.intensity = caveGlow + Math.sin(simTime * 8.0) * 0.25;
        tribeAnimState.caveInteriorLight2.intensity = caveGlow * 0.85 + Math.cos(simTime * 7.5) * 0.2;
      }
      if (tribeAnimState.roastRackMeat) {
        tribeAnimState.roastRackMeat.rotation.x = simTime * 1.2;
        tribeAnimState.roastRackMeat.visible = (routineMode !== 'SLEEP');
      }

      // Floating Zzz sleep bubbles visible only at NIGHT
      tribeAnimState.zzzSprites.forEach((zObj, idx) => {
        zObj.sprite.visible = (routineMode === 'SLEEP');
        if (zObj.sprite.visible) {
          const floatCycle = (simTime * 0.55 + idx * 0.33) % 1.0;
          zObj.sprite.position.set(
            zObj.baseX + Math.sin(simTime * 2.0 + idx) * 0.25,
            zObj.baseY + floatCycle * 1.6,
            zObj.baseZ
          );
          const sc = 0.65 + Math.sin(floatCycle * Math.PI) * 0.55;
          zObj.sprite.scale.set(2.8 * sc, 1.4 * sc, 1);
        }
      });

      // Apply DINE or SLEEP pose if it's Dusk or Night!
      if (routineMode === 'DINE' || routineMode === 'SLEEP') {
        tribeAnimState.allHumans.forEach((h, idx) => {
          applyHumanRoutineTransform(h, routineMode, idx);
        });

        // Hide stone-knapping sparks & fishing line when everyone is home eating or sleeping
        tribeAnimState.knapSparks.forEach(sp => { sp.mesh.visible = false; });
        if (tribeAnimState.hookedFish) tribeAnimState.hookedFish.visible = false;
        if (tribeAnimState.fishingLine) tribeAnimState.fishingLine.visible = false;

        // Pull the wooden sampan boat onto the shallow cobble beach for the evening/night!
        if (tribeAnimState.sampanBoat) {
          const mooredY = Math.max(getSmoothGroundY(3.4, 5.5) - 0.05, seaLevel + 0.08);
          tribeAnimState.sampanBoat.position.set(3.4, mooredY, 5.5);
          tribeAnimState.sampanBoat.rotation.set(0, -0.35, 0);
        }

        // Wild Boar & Barking Deer rest / graze peacefully on the upper meadow at dusk & night
        if (tribeAnimState.wildBoar) {
          const wy = getSmoothGroundY(-17.5, 4.2);
          tribeAnimState.wildBoar.group.position.set(-17.5, wy, 4.2);
          tribeAnimState.wildBoar.group.rotation.set(0, 0.6, routineMode === 'SLEEP' ? 0.35 : 0);
          tribeAnimState.wildBoar.legs.forEach(l => { l.rotation.x = 0; });
        }
        if (tribeAnimState.barkingDeer) {
          const dy = getSmoothGroundY(-16.5, 2.2);
          tribeAnimState.barkingDeer.group.position.set(-16.5, dy, 2.2);
          tribeAnimState.barkingDeer.group.rotation.set(0, 1.2, routineMode === 'SLEEP' ? 0.40 : 0);
          tribeAnimState.barkingDeer.legs.forEach(l => { l.rotation.x = 0; });
        }

        if (activeFollowMode === 'HUMAN_HUNT' && controlMode === 'ORBIT') {
          orbitTarget.lerp(new THREE.Vector3(-11.2, 6.0, 5.0), 0.08);
          updateOrbitCamera();
        }
        return;
      }

      // =======================================================================
      // DAYTIME / DAWN WORK MODE ('WORK' - 白晝全族分頭狩獵、海邊採集、捕魚、製器)
      // =======================================================================
      tribeAnimState.allHumans.forEach((h, idx) => {
        applyHumanRoutineTransform(h, 'WORK', idx);
        h.root.position.copy(h.workLocalPos);
      });

      // 1. 🔥 Fire-making & Hearth Tending (HUMAN_FIRE)
      if (tribeAnimState.fireTenderA) {
        const stoke = Math.sin(simTime * 3.8);
        tribeAnimState.fireTenderA.torsoPivot.rotation.x = 0.18 + stoke * 0.08;
        tribeAnimState.fireTenderA.armRPivot.rotation.x = -0.85 + stoke * 0.35;
        tribeAnimState.fireTenderA.armLPivot.rotation.x = -0.55 - stoke * 0.20;
      }
      if (tribeAnimState.fireTenderB) {
        const warm = Math.sin(simTime * 2.6);
        tribeAnimState.fireTenderB.armLPivot.rotation.x = -0.95 + warm * 0.18;
        tribeAnimState.fireTenderB.armRPivot.rotation.x = -0.95 - warm * 0.18;
        tribeAnimState.fireTenderB.torsoPivot.rotation.y = Math.sin(simTime * 1.2) * 0.15;
      }

      // 2. 🪵 Wood Gathering (HUMAN_WOOD)
      if (tribeAnimState.woodGathererA) {
        const bend = (Math.sin(simTime * 2.2) + 1) * 0.5;
        tribeAnimState.woodGathererA.torsoPivot.rotation.x = bend * 0.72;
        tribeAnimState.woodGathererA.armRPivot.rotation.x = -0.35 - bend * 0.75;
        tribeAnimState.woodGathererA.armLPivot.rotation.x = -0.35 - bend * 0.65;
      }
      if (tribeAnimState.woodCarrierB) {
        const walkCycle = simTime * 1.4;
        const walkX = 1.3 + Math.sin(walkCycle) * 1.1;
        const dir = Math.cos(walkCycle) >= 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
        tribeAnimState.woodCarrierB.root.position.x = walkX;
        tribeAnimState.woodCarrierB.root.rotation.y = dir;
        const step = Math.sin(simTime * 5.6) * 0.48;
        tribeAnimState.woodCarrierB.legLPivot.rotation.x = step;
        tribeAnimState.woodCarrierB.legRPivot.rotation.x = -step;
        tribeAnimState.woodCarrierB.armLPivot.rotation.x = -step * 0.6;
        tribeAnimState.woodCarrierB.armRPivot.rotation.x = -2.2;
      }

      // 3. 🧶 Weaving Rattan Vine & Beating Bark Cloth (HUMAN_BARK_VINE)
      if (tribeAnimState.barkBeaterHuman) {
        const beatWave = Math.sin(simTime * 6.5);
        const strikeAngle = beatWave > 0 ? -1.45 + Math.pow(beatWave, 2) * 1.15 : -1.45 - beatWave * 0.25;
        tribeAnimState.barkBeaterHuman.armRPivot.rotation.x = strikeAngle;
        tribeAnimState.barkBeaterHuman.armLPivot.rotation.x = -0.65 + Math.cos(simTime * 3.25) * 0.15;
        tribeAnimState.barkBeaterHuman.torsoPivot.rotation.x = 0.15 + (beatWave > 0.6 ? 0.12 : 0);
        if (tribeAnimState.barkClothSheet) {
          const stretch = 1.0 + (beatWave > 0.7 ? 0.14 : 0);
          tribeAnimState.barkClothSheet.scale.set(stretch, 1.0, stretch);
        }
      }
      if (tribeAnimState.vineWeaverHuman) {
        const twist = simTime * 4.8;
        tribeAnimState.vineWeaverHuman.armLPivot.rotation.x = -0.85 + Math.sin(twist) * 0.32;
        tribeAnimState.vineWeaverHuman.armRPivot.rotation.x = -0.85 + Math.cos(twist) * 0.32;
        tribeAnimState.vineWeaverHuman.armLPivot.rotation.y = Math.cos(twist) * 0.18;
        tribeAnimState.vineWeaverHuman.armRPivot.rotation.y = -Math.sin(twist) * 0.18;
        if (tribeAnimState.vineRopeCoil) {
          tribeAnimState.vineRopeCoil.rotation.z = simTime * 3.5;
        }
      }

      // 4. 🪨 Knapping Stone Tools (HUMAN_STONE) with Impact Sparks!
      if (tribeAnimState.stoneKnapperA) {
        const knapPhase = (simTime * 1.9) % 1.0;
        let rArmX = -0.8;
        if (knapPhase < 0.45) {
          rArmX = -0.75 - (knapPhase / 0.45) * 0.95;
        } else if (knapPhase < 0.56) {
          const t = (knapPhase - 0.45) / 0.11;
          rArmX = -1.70 + t * 1.25;
        } else {
          rArmX = -0.45 - ((knapPhase - 0.56) / 0.44) * 0.30;
        }
        tribeAnimState.stoneKnapperA.armRPivot.rotation.x = rArmX;
        tribeAnimState.stoneKnapperA.armLPivot.rotation.x = -0.78;
        tribeAnimState.stoneKnapperA.torsoPivot.rotation.x = knapPhase > 0.45 && knapPhase < 0.6 ? 0.24 : 0.12;

        const sparkTime = knapPhase >= 0.50 ? (knapPhase - 0.50) * 1.8 : -1;
        tribeAnimState.knapSparks.forEach(sp => {
          if (sparkTime >= 0 && sparkTime <= 0.75) {
            sp.mesh.visible = true;
            sp.mesh.position.set(
              -0.25 + sp.vx * sparkTime * 0.55,
              0.42 + sp.vy * sparkTime * 0.45 - 2.8 * sparkTime * sparkTime,
              sp.vz * sparkTime * 0.55
            );
            const s = Math.max(0.1, 1.0 - sparkTime * 1.2);
            sp.mesh.scale.set(s, s, s);
          } else {
            sp.mesh.visible = false;
          }
        });
      }
      if (tribeAnimState.stoneKnapperB) {
        const retouch = Math.sin(simTime * 5.2);
        tribeAnimState.stoneKnapperB.armRPivot.rotation.x = -0.85 + retouch * 0.25;
        tribeAnimState.stoneKnapperB.armLPivot.rotation.x = -0.75 - retouch * 0.15;
      }

      // 5. 🐗 Wide-Ranging Hunting All Around the Cave Dwellings (HUMAN_HUNT)
      const huntPhase = simTime * 0.42; // Sweeps a huge 22m x 14m loop around the cave settlement!
      if (tribeAnimState.wildBoar) {
        const pt = getWideHuntTrailPoint(huntPhase, 0.0);
        const boarBounce = Math.abs(Math.sin(simTime * 11.0)) * 0.15;
        tribeAnimState.wildBoar.group.position.set(pt.wx, pt.wy + boarBounce, pt.wz);
        tribeAnimState.wildBoar.group.rotation.set(0, pt.yaw, 0);
        const gallop = Math.sin(simTime * 11.5) * 0.60;
        tribeAnimState.wildBoar.legs[0].rotation.x = gallop;
        tribeAnimState.wildBoar.legs[1].rotation.x = -gallop;
        tribeAnimState.wildBoar.legs[2].rotation.x = -gallop;
        tribeAnimState.wildBoar.legs[3].rotation.x = gallop;
      }
      if (tribeAnimState.barkingDeer) {
        const pt = getWideHuntTrailPoint(huntPhase + 2.4, -0.8);
        const boundJump = Math.max(0, Math.sin(simTime * 8.2)) * 0.42;
        tribeAnimState.barkingDeer.group.position.set(pt.wx, pt.wy + boundJump, pt.wz);
        tribeAnimState.barkingDeer.group.rotation.set(Math.cos(simTime * 8.2) * 0.16, pt.yaw, 0);
        const stride = Math.sin(simTime * 11.0) * 0.65;
        tribeAnimState.barkingDeer.legs[0].rotation.x = stride;
        tribeAnimState.barkingDeer.legs[1].rotation.x = -stride;
        tribeAnimState.barkingDeer.legs[2].rotation.x = -stride;
        tribeAnimState.barkingDeer.legs[3].rotation.x = stride;
      }
      if (tribeAnimState.hunterA) {
        // Chasing right behind the Wild Boar across the terraces!
        const pt = getWideHuntTrailPoint(huntPhase - 0.28, 0.0);
        tribeAnimState.hunterA.root.position.set(pt.wx, pt.wy, pt.wz);
        tribeAnimState.hunterA.root.rotation.set(0, pt.yaw, 0);
        const runStep = Math.sin(simTime * 9.5) * 0.68;
        tribeAnimState.hunterA.legLPivot.rotation.x = runStep;
        tribeAnimState.hunterA.legRPivot.rotation.x = -runStep;
        tribeAnimState.hunterA.armLPivot.rotation.x = -runStep * 0.7;
        tribeAnimState.hunterA.armRPivot.rotation.x = -1.35 + Math.sin(simTime * 5.0) * 0.42;
      }
      if (tribeAnimState.hunterB) {
        // Chasing right behind the Barking Deer across the terraces!
        const pt = getWideHuntTrailPoint(huntPhase + 2.12, -0.8);
        tribeAnimState.hunterB.root.position.set(pt.wx, pt.wy, pt.wz);
        tribeAnimState.hunterB.root.rotation.set(0, pt.yaw, 0);
        const runStep2 = Math.cos(simTime * 9.5) * 0.68;
        tribeAnimState.hunterB.legLPivot.rotation.x = runStep2;
        tribeAnimState.hunterB.legRPivot.rotation.x = -runStep2;
        tribeAnimState.hunterB.armLPivot.rotation.x = -runStep2 * 0.7;
        tribeAnimState.hunterB.armRPivot.rotation.x = -1.40 + Math.cos(simTime * 5.2) * 0.38;
      }
      if (tribeAnimState.hunterC) {
        // Third hunter flanking along the inner settlement trail!
        const pt = getWideHuntTrailPoint(huntPhase - 0.55, 0.9);
        tribeAnimState.hunterC.root.position.set(pt.wx, pt.wy, pt.wz);
        tribeAnimState.hunterC.root.rotation.set(0, pt.yaw, 0);
        const runStep3 = Math.sin(simTime * 9.5 + 1.5) * 0.68;
        tribeAnimState.hunterC.legLPivot.rotation.x = runStep3;
        tribeAnimState.hunterC.legRPivot.rotation.x = -runStep3;
        tribeAnimState.hunterC.armLPivot.rotation.x = -runStep3 * 0.7;
        tribeAnimState.hunterC.armRPivot.rotation.x = -1.30 + Math.sin(simTime * 4.8) * 0.40;
      }

      // If camera is following the wide-ranging hunt, smoothly track Hunter A & Wild Boar!
      if (activeFollowMode === 'HUMAN_HUNT' && controlMode === 'ORBIT' && tribeAnimState.wildBoar) {
        orbitTarget.lerp(tribeAnimState.wildBoar.group.position, 0.08);
        updateOrbitCamera();
      }

      // 6. 🐚 Female Intertidal Seaweed & Shellfish Gatherers + Sanxiantai Tombolo Low-Tide Island Walker (HUMAN_FORAGE)
      tribeAnimState.foragerWomen.forEach((fw, idx) => {
        const { human, cfg } = fw;

        if (cfg.isTomboloWalker) {
          // Only crosses the Sanxiantai Tombolo when the tide is low (seaLevel <= -0.30m)!
          if (seaLevel <= -0.30) {
            const walkT = (Math.sin(simTime * 0.45) + 1) * 0.5; // 0 (Mainland) <-> 1 (Sanxiantai Island)
            const dirSign = Math.cos(simTime * 0.45) >= 0 ? 1 : -1;
            const wx = 2.0 + walkT * 10.6;
            const wz = 12.5 + walkT * 7.6 + Math.sin(wx * 0.55) * 0.55;
            const wy = Math.max(getSmoothGroundY(wx, wz), -0.32);
            human.root.position.set(wx, wy, wz);
            human.root.rotation.set(0, Math.atan2(dirSign * 10.6, dirSign * 7.6), 0);

            const step = Math.sin(simTime * 5.8) * 0.48;
            human.torsoPivot.rotation.x = 0.08;
            human.legLPivot.rotation.x = step;
            human.legRPivot.rotation.x = -step;
            human.armLPivot.rotation.x = -step * 0.5;
            human.armRPivot.rotation.x = step * 0.5;
            return;
          }
          // When high tide submerges the tombolo, she stays safely on the mainland cobble headland!
        }

        const cycle = simTime * 0.65 + cfg.phase;
        const gatherWave = Math.sin(simTime * 1.8 + cfg.phase);
        const isGathering = gatherWave > 0.15;

        const wx = cfg.centerX + Math.cos(cycle) * cfg.rx;
        const wz = cfg.centerZ + Math.sin(cycle) * cfg.rz;
        const vx = -Math.sin(cycle) * cfg.rx;
        const vz =  Math.cos(cycle) * cfg.rz;
        const wy = Math.max(getSmoothGroundY(wx, wz), seaLevel - 0.15);

        human.root.position.set(wx, wy, wz);
        human.root.rotation.set(0, Math.atan2(vx, vz), 0);

        if (isGathering) {
          const bendAmt = Math.min(1.0, (gatherWave - 0.15) / 0.65);
          human.torsoPivot.rotation.x = bendAmt * 0.78;
          const scrape = Math.sin(simTime * 7.5 + idx) * 0.35;
          human.armRPivot.rotation.x = -0.85 - bendAmt * 0.45 + scrape;
          human.armLPivot.rotation.x = -0.65 - bendAmt * 0.35 - scrape * 0.5;
          human.legLPivot.rotation.x = 0;
          human.legRPivot.rotation.x = 0;
        } else {
          human.torsoPivot.rotation.x = 0.08;
          const step = Math.sin(simTime * 5.2 + idx) * 0.42;
          human.legLPivot.rotation.x = step;
          human.legRPivot.rotation.x = -step;
          human.armLPivot.rotation.x = -step * 0.5;
          human.armRPivot.rotation.x = step * 0.5;
        }
      });

      // 7. 🛶 Male Fishing: Wooden Plank Sampan & Shoreline Angling (HUMAN_FISH)
      if (tribeAnimState.sampanBoat) {
        const boatX = 9.5 + Math.sin(simTime * 0.55) * 0.65;
        const boatZ = 5.5 + Math.cos(simTime * 0.45) * 0.85;
        const waveBobY = seaLevel + 0.12 + Math.sin(simTime * 1.8 * waveSpeedMultiplier + boatX * 0.3) * 0.22 * waveHeightMultiplier;
        const rollZ = Math.cos(simTime * 1.8 * waveSpeedMultiplier) * 0.08 * waveHeightMultiplier;
        const pitchX = Math.sin(simTime * 1.5 * waveSpeedMultiplier) * 0.07 * waveHeightMultiplier;
        tribeAnimState.sampanBoat.position.set(boatX, waveBobY, boatZ);
        tribeAnimState.sampanBoat.rotation.set(pitchX, 0, rollZ);

        if (tribeAnimState.sampanPaddler) {
          tribeAnimState.sampanPaddler.root.position.set(boatX - 0.25, waveBobY + 0.16, boatZ - 0.85);
          const stroke = Math.sin(simTime * 2.8);
          tribeAnimState.sampanPaddler.armLPivot.rotation.x = -0.65 + stroke * 0.55;
          tribeAnimState.sampanPaddler.torsoPivot.rotation.x = 0.15 + stroke * 0.12;
        }
        if (tribeAnimState.sampanHarpooner) {
          tribeAnimState.sampanHarpooner.root.position.set(boatX + 0.15, waveBobY + 0.16, boatZ + 0.95);
          const thrust = Math.sin(simTime * 2.4);
          tribeAnimState.sampanHarpooner.armRPivot.rotation.x = -1.15 + (thrust > 0 ? thrust * 0.55 : thrust * 0.18);
          tribeAnimState.sampanHarpooner.torsoPivot.rotation.x = thrust > 0 ? thrust * 0.18 : 0;
        }
      }
      if (tribeAnimState.shoreAngler && tribeAnimState.hookedFish && tribeAnimState.fishingLine) {
        tribeAnimState.hookedFish.visible = true;
        tribeAnimState.fishingLine.visible = true;
        const tug = Math.sin(simTime * 3.6);
        tribeAnimState.shoreAngler.armRPivot.rotation.x = -0.78 + tug * 0.22;
        tribeAnimState.shoreAngler.torsoPivot.rotation.x = -0.08 + tug * 0.08;

        const fishY = (seaLevel - 1.5) + Math.sin(simTime * 6.5) * 0.22 + (tug > 0.3 ? 0.28 : 0);
        const fishZ = Math.cos(simTime * 4.2) * 0.32;
        tribeAnimState.hookedFish.position.set(2.35, fishY, fishZ);
        tribeAnimState.hookedFish.rotation.y = Math.sin(simTime * 12.0) * 0.45;

        const tipLiftY = 1.48 - tug * 0.25;
        const posAttr = tribeAnimState.fishingLine.geometry.attributes.position;
        posAttr.setXYZ(0, 2.05, tipLiftY, 0);
        posAttr.setXYZ(1, 2.35, fishY + 0.15, fishZ);
        posAttr.needsUpdate = true;
      }
    }
