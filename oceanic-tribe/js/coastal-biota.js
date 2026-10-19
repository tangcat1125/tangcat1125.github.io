    // =========================================================================
    // 6. 臨岸型水生動物與植物立體動態小模型 (舒緩自然動畫節奏)
    // =========================================================================
    const biotaGroup = new THREE.Group();
    scene.add(biotaGroup);

    const biotaEntities = [];
    const biotaInteractiveMeshes = [];
    const migrationSquads = []; // Coordinated Kuroshio Migration Chains: Flying Fish -> Mahi-Mahi -> Yellowfin Tuna
    let activeFollowMode = null; // null | 'FLYING_FISH' | 'MAHI_MAHI' | 'YELLOWFIN_TUNA' | 'MIGRATION_CHAIN'


    function tagBiotaHierarchy(rootObj, speciesKey) {
      rootObj.userData.speciesKey = speciesKey;
      rootObj.traverse(child => {
        if (child.isMesh) {
          child.userData.speciesKey = speciesKey;
          biotaInteractiveMeshes.push(child);
        }
      });
    }

    function createSeaweedModel(x, y, z, isKelp = false) {
      const group = new THREE.Group();
      group.position.set(x, y, z);

      const bladeCount = isKelp ? 5 : 4;
      const blades = [];
      const mat = new THREE.MeshLambertMaterial({
        color: isKelp ? 0xb45309 : 0x22c55e,
        emissive: isKelp ? 0x451a03 : 0x064e3b,
        emissiveIntensity: 0.25
      });

      for (let b = 0; b < bladeCount; b++) {
        const bladePivot = new THREE.Group();
        bladePivot.position.set((b - 1.5) * 0.16, 0, ((b % 2) - 0.5) * 0.16);
        const segs = isKelp ? 4 : 3;
        for (let s = 0; s < segs; s++) {
          const w = isKelp ? 0.14 : 0.22 - s * 0.03;
          const h = isKelp ? 0.38 : 0.26;
          const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.07), mat);
          mesh.position.set(0, s * (h - 0.03) + h * 0.5, 0);
          bladePivot.add(mesh);
        }
        group.add(bladePivot);
        blades.push(bladePivot);
      }

      tagBiotaHierarchy(group, 'SEAWEED');
      biotaGroup.add(group);
      biotaEntities.push({
        type: 'SEAWEED',
        group,
        blades,
        baseX: x,
        baseZ: z,
        phase: Math.random() * Math.PI * 2
      });
    }

    function createCrabModel(x, z) {
      const gy = getSurfaceY(x, z) + 0.55;
      const group = new THREE.Group();
      group.position.set(x, gy, z);

      const shellMat = new THREE.MeshLambertMaterial({ color: 0xdc2626 });
      const legMat = new THREE.MeshLambertMaterial({ color: 0x991b1b });
      const clawMat = new THREE.MeshLambertMaterial({ color: 0xf97316 });
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111827 });

      const body = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.20, 0.36), shellMat);
      body.position.y = 0.12;
      group.add(body);

      const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.06), eyeMat);
      eyeL.position.set(-0.12, 0.24, 0.16);
      const eyeR = eyeL.clone();
      eyeR.position.x = 0.12;
      group.add(eyeL, eyeR);

      const clawLPivot = new THREE.Group();
      clawLPivot.position.set(-0.26, 0.14, 0.18);
      const clawLMesh = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.14, 0.24), clawMat);
      clawLMesh.position.set(-0.08, 0, 0.10);
      clawLPivot.add(clawLMesh);

      const clawRPivot = new THREE.Group();
      clawRPivot.position.set(0.26, 0.14, 0.18);
      const clawRMesh = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.14, 0.24), clawMat);
      clawRMesh.position.set(0.08, 0, 0.10);
      clawRPivot.add(clawRMesh);
      group.add(clawLPivot, clawRPivot);

      const legs = [];
      for (let side of [-1, 1]) {
        for (let i = -1; i <= 1; i++) {
          const legPivot = new THREE.Group();
          legPivot.position.set(side * 0.24, 0.10, i * 0.11);
          const legMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.06), legMat);
          legMesh.position.set(side * 0.10, -0.04, 0);
          legMesh.rotation.z = -side * 0.35;
          legPivot.add(legMesh);
          group.add(legPivot);
          legs.push({ pivot: legPivot, side, idx: i });
        }
      }

      tagBiotaHierarchy(group, 'CRAB');
      biotaGroup.add(group);
      biotaEntities.push({
        type: 'CRAB',
        group,
        clawLPivot,
        clawRPivot,
        legs,
        originX: x,
        originZ: z,
        phase: Math.random() * Math.PI * 2,
        speed: 0.75 + Math.random() * 0.55
      });
    }

    function createBlennyModel(x, z) {
      const gy = getSurfaceY(x, z) + 0.52;
      const group = new THREE.Group();
      group.position.set(x, gy, z);

      const bodyMat = new THREE.MeshLambertMaterial({ color: 0xd97706 });
      const finMat = new THREE.MeshLambertMaterial({ color: 0xfbbf24 });
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

      const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.28), bodyMat);
      head.position.set(0, 0.1, 0.12);
      group.add(head);

      const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.06), eyeMat);
      eyeL.position.set(-0.06, 0.21, 0.20);
      const eyeR = eyeL.clone();
      eyeR.position.x = 0.06;
      group.add(eyeL, eyeR);

      const dorsal = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, 0.32), finMat);
      dorsal.position.set(0, 0.22, -0.02);
      group.add(dorsal);

      const tailPivot = new THREE.Group();
      tailPivot.position.set(0, 0.09, -0.02);
      const tailBody = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.30), bodyMat);
      tailBody.position.set(0, 0, -0.15);
      const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.14), finMat);
      tailFin.position.set(0, 0.02, -0.32);
      tailPivot.add(tailBody, tailFin);
      group.add(tailPivot);

      tagBiotaHierarchy(group, 'BLENNY');
      biotaGroup.add(group);
      biotaEntities.push({
        type: 'BLENNY',
        group,
        tailPivot,
        originX: x,
        originY: gy,
        originZ: z,
        phase: Math.random() * Math.PI * 2
      });
    }

    function createGiantClamModel(x, z) {
      const gy = getSurfaceY(x, z) + 0.52;
      const group = new THREE.Group();
      group.position.set(x, gy, z);

      const shellMat = new THREE.MeshLambertMaterial({ color: 0xe2e8f0 });
      const mantleMat = new THREE.MeshLambertMaterial({
        color: 0x06b6d4,
        emissive: 0x0e7490,
        emissiveIntensity: 0.45
      });

      const mantle = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.42), mantleMat);
      mantle.position.y = 0.12;
      group.add(mantle);

      const leftValve = new THREE.Group();
      leftValve.position.set(-0.06, 0.04, 0);
      const lMesh = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.28, 0.48), shellMat);
      lMesh.position.set(-0.06, 0.14, 0);
      leftValve.add(lMesh);

      const rightValve = new THREE.Group();
      rightValve.position.set(0.06, 0.04, 0);
      const rMesh = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.28, 0.48), shellMat);
      rMesh.position.set(0.06, 0.14, 0);
      rightValve.add(rMesh);

      group.add(leftValve, rightValve);
      tagBiotaHierarchy(group, 'CLAM_URCHIN');
      biotaGroup.add(group);

      biotaEntities.push({
        type: 'CLAM',
        group,
        leftValve,
        rightValve,
        mantle,
        phase: Math.random() * Math.PI * 2
      });
    }

    function createSeaUrchinModel(x, z) {
      const gy = getSurfaceY(x, z) + 0.55;
      const group = new THREE.Group();
      group.position.set(x, gy, z);

      const coreMat = new THREE.MeshLambertMaterial({ color: 0x3b0764 });
      const spineMat = new THREE.MeshLambertMaterial({ color: 0x581c87 });

      const core = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.24), coreMat);
      core.position.y = 0.09;
      group.add(core);

      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const sp = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.28, 0.04), spineMat);
        sp.position.set(Math.cos(angle) * 0.10, 0.16, Math.sin(angle) * 0.10);
        sp.rotation.z = -Math.cos(angle) * 0.65;
        sp.rotation.x = Math.sin(angle) * 0.65;
        group.add(sp);
      }

      tagBiotaHierarchy(group, 'CLAM_URCHIN');
      biotaGroup.add(group);
      biotaEntities.push({
        type: 'URCHIN',
        group,
        originX: x,
        originZ: z,
        phase: Math.random() * Math.PI * 2
      });
    }

    function createSeaTurtleModel(x, y, z) {
      const group = new THREE.Group();
      group.position.set(x, y, z);

      const carapaceMat = new THREE.MeshLambertMaterial({ color: 0x3f6212 });
      const skinMat = new THREE.MeshLambertMaterial({ color: 0x84cc16 });

      const shell = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.26, 1.05), carapaceMat);
      const shellTop = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.14, 0.78), carapaceMat);
      shellTop.position.y = 0.16;
      group.add(shell, shellTop);

      const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.20, 0.32), skinMat);
      head.position.set(0, 0.02, 0.64);
      group.add(head);

      const flipperL = new THREE.Group();
      flipperL.position.set(-0.42, 0, 0.32);
      const flMesh = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.06, 0.24), skinMat);
      flMesh.position.set(-0.26, 0, 0);
      flipperL.add(flMesh);

      const flipperR = new THREE.Group();
      flipperR.position.set(0.42, 0, 0.32);
      const frMesh = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.06, 0.24), skinMat);
      frMesh.position.set(0.26, 0, 0);
      flipperR.add(frMesh);

      const rearL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 0.20), skinMat);
      rearL.position.set(-0.36, -0.04, -0.52);
      const rearR = rearL.clone();
      rearR.position.x = 0.36;

      group.add(flipperL, flipperR, rearL, rearR);
      tagBiotaHierarchy(group, 'TURTLE');
      biotaGroup.add(group);

      biotaEntities.push({
        type: 'TURTLE',
        group,
        flipperL,
        flipperR,
        centerX: x,
        centerY: y,
        centerZ: z,
        angle: Math.random() * Math.PI * 2,
        radius: 3.2 + Math.random() * 2.5
      });
    }

    // -------------------------------------------------------------------------
    // 黑潮洄游鏈【第一層：前鋒】飛魚模型 (Flying Fish)
    // -------------------------------------------------------------------------
    function buildFlyingFishMesh() {
      const group = new THREE.Group();
      const bodyMat = new THREE.MeshLambertMaterial({ color: 0x0284c7, emissive: 0x0369a1, emissiveIntensity: 0.3 });
      const bellyMat = new THREE.MeshLambertMaterial({ color: 0xe0f2fe });
      const wingMat = new THREE.MeshLambertMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.86 });

      const body = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.72), bodyMat);
      const belly = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.68), bellyMat);
      belly.position.y = -0.08;
      group.add(body, belly);

      const wingL = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.03, 0.36), wingMat);
      wingL.position.set(-0.34, 0.02, 0.08);
      const wingR = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.03, 0.36), wingMat);
      wingR.position.set(0.34, 0.02, 0.08);
      group.add(wingL, wingR);

      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.32, 0.24), bodyMat);
      tail.position.set(0, 0, -0.42);
      group.add(tail);

      tagBiotaHierarchy(group, 'FLYING_FISH');
      biotaGroup.add(group);
      return { group, wingL, wingR, tail };
    }

    // -------------------------------------------------------------------------
    // 黑潮洄游掠食鏈【第二層：追捕吞食飛魚】鬼頭刀 / 飛烏虎模型 (Mahi-Mahi)
    // 具備可動下顎 (jawPivot)，衝刺時張口咬住飛魚吞食！
    // -------------------------------------------------------------------------
    function buildMahiMahiMesh(baseScale = 1.08) {
      const group = new THREE.Group();

      const foreheadMat = new THREE.MeshLambertMaterial({ color: 0x00a896, emissive: 0x047857, emissiveIntensity: 0.25 }); // 藍綠隆起方額
      const flankMat    = new THREE.MeshLambertMaterial({ color: 0xfacc15, emissive: 0xca8a04, emissiveIntensity: 0.2 });  // 金黃色體側
      const dorsalMat   = new THREE.MeshLambertMaterial({ color: 0x0284c7, emissive: 0x1d4ed8, emissiveIntensity: 0.3 });  // 寶藍色長背鰭
      const mouthMat    = new THREE.MeshBasicMaterial({ color: 0xbe123c }); // 口腔深紅
      const eyeMat      = new THREE.MeshBasicMaterial({ color: 0x111827 });

      // Iconic steep squared bull-forehead + upper snout
      const bullHead = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.36, 0.56), foreheadMat);
      bullHead.position.set(0, 0.12, 0.42);
      const mouthInterior = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.10, 0.28), mouthMat);
      mouthInterior.position.set(0, -0.02, 0.50);
      const goldenBelly = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.24, 0.82), flankMat);
      goldenBelly.position.set(0, -0.10, 0.04);
      const midTorso = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.38, 0.68), foreheadMat);
      midTorso.position.set(0, 0.02, -0.12);
      group.add(bullHead, mouthInterior, goldenBelly, midTorso);

      // Articulated Lower Jaw for snapping & eating Flying Fish!
      const jawPivot = new THREE.Group();
      jawPivot.position.set(0, -0.06, 0.30);
      const lowerJaw = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.10, 0.38), flankMat);
      lowerJaw.position.set(0, -0.03, 0.18);
      jawPivot.add(lowerJaw);
      group.add(jawPivot);

      // Eyes
      const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.08), eyeMat);
      eyeL.position.set(-0.15, 0.12, 0.54);
      const eyeR = eyeL.clone();
      eyeR.position.x = 0.15;
      group.add(eyeL, eyeR);

      // Continuous long electric-blue dorsal crest running from head to tail
      const dorsalCrest = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 1.18), dorsalMat);
      dorsalCrest.position.set(0, 0.32, 0.08);
      group.add(dorsalCrest);

      // Pectoral fins
      const pecL = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.04, 0.18), dorsalMat);
      pecL.position.set(-0.26, -0.06, 0.32);
      pecL.rotation.y = 0.3;
      const pecR = pecL.clone();
      pecR.position.x = 0.26;
      pecR.rotation.y = -0.3;
      group.add(pecL, pecR);

      // Articulated tapering tail & deeply forked yellow caudal fin
      const tailPivot = new THREE.Group();
      tailPivot.position.set(0, 0, -0.46);
      const tailPeduncle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.20, 0.42), flankMat);
      tailPeduncle.position.set(0, 0, -0.20);
      const forkUpper = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.34, 0.24), flankMat);
      forkUpper.position.set(0, 0.16, -0.46);
      forkUpper.rotation.x = 0.35;
      const forkLower = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.34, 0.24), flankMat);
      forkLower.position.set(0, -0.16, -0.46);
      forkLower.rotation.x = -0.35;
      tailPivot.add(tailPeduncle, forkUpper, forkLower);
      group.add(tailPivot);

      group.scale.setScalar(baseScale);
      tagBiotaHierarchy(group, 'MAHI_MAHI');
      biotaGroup.add(group);
      return { group, tailPivot, dorsalCrest, jawPivot, baseScale };
    }

    // -------------------------------------------------------------------------
    // 黑潮洄游掠食鏈【第三層：頂級掠食者・獵食鬼頭刀】大型黃鰭鮪魚模型 (Yellowfin Tuna)
    // 體型碩大 (1.42x) 並具可動大下顎 (jawPivot)，從黑潮中深層衝刺突襲吞食鬼頭刀！
    // -------------------------------------------------------------------------
    function buildYellowfinTunaMesh(baseScale = 1.42) {
      const group = new THREE.Group();

      const darkBlueBackMat = new THREE.MeshLambertMaterial({ color: 0x1e3a8a, emissive: 0x172554, emissiveIntensity: 0.25 }); // 鐵藍背脊
      const silverBellyMat  = new THREE.MeshLambertMaterial({ color: 0xcbd5e1 }); // 銀白下腹
      const goldStripeMat   = new THREE.MeshLambertMaterial({ color: 0xf59e0b, emissive: 0xb45309, emissiveIntensity: 0.25 }); // 金黃側帶
      const yellowFinMat    = new THREE.MeshLambertMaterial({ color: 0xfacc15, emissive: 0xca8a04, emissiveIntensity: 0.35 }); // 鮮黃鐮刀背臀鰭
      const mouthMat        = new THREE.MeshBasicMaterial({ color: 0x9f1239 });
      const eyeMat          = new THREE.MeshBasicMaterial({ color: 0x0f172a });

      // Robust fusiform torpedo body
      const upperTorso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.36, 1.34), darkBlueBackMat);
      upperTorso.position.set(0, 0.13, 0.10);
      const goldBand = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.10, 1.30), goldStripeMat);
      goldBand.position.set(0, -0.02, 0.10);
      const lowerBelly = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.24, 1.16), silverBellyMat);
      lowerBelly.position.set(0, -0.18, 0.04);
      const snout = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.38), darkBlueBackMat);
      snout.position.set(0, 0.08, 0.88);
      const mouthInterior = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.30), mouthMat);
      mouthInterior.position.set(0, -0.02, 0.82);
      group.add(upperTorso, goldBand, lowerBelly, snout, mouthInterior);

      // Articulated Massive Lower Jaw for catching & swallowing Mahi-Mahi!
      const jawPivot = new THREE.Group();
      jawPivot.position.set(0, -0.08, 0.62);
      const lowerJaw = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.11, 0.42), silverBellyMat);
      lowerJaw.position.set(0, -0.03, 0.20);
      jawPivot.add(lowerJaw);
      group.add(jawPivot);

      // Eyes
      const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.09), eyeMat);
      eyeL.position.set(-0.18, 0.10, 0.86);
      const eyeR = eyeL.clone();
      eyeR.position.x = 0.18;
      group.add(eyeL, eyeR);

      // First dorsal fin + Iconic long sickle-shaped bright yellow Second Dorsal Fin & Anal Fin!
      const dorsal1 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.24, 0.34), darkBlueBackMat);
      dorsal1.position.set(0, 0.36, 0.28);

      const yellowSickleDorsal = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.52, 0.24), yellowFinMat);
      yellowSickleDorsal.position.set(0, 0.50, -0.22);
      yellowSickleDorsal.rotation.x = -0.45;

      const yellowSickleAnal = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.50, 0.24), yellowFinMat);
      yellowSickleAnal.position.set(0, -0.48, -0.24);
      yellowSickleAnal.rotation.x = 0.45;
      group.add(dorsal1, yellowSickleDorsal, yellowSickleAnal);

      // Long wing-like pectoral fins
      const pecL = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.05, 0.22), darkBlueBackMat);
      pecL.position.set(-0.44, -0.04, 0.30);
      pecL.rotation.y = 0.25;
      const pecR = pecL.clone();
      pecR.position.x = 0.44;
      pecR.rotation.y = -0.25;
      group.add(pecL, pecR);

      // Caudal peduncle with yellow finlets & powerful lunate tail fin
      const tailPivot = new THREE.Group();
      tailPivot.position.set(0, 0, -0.56);
      const peduncle = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.18, 0.46), darkBlueBackMat);
      peduncle.position.set(0, 0, -0.22);
      const finletsTop = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.36), yellowFinMat);
      finletsTop.position.set(0, 0.13, -0.22);
      const finletsBot = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.36), yellowFinMat);
      finletsBot.position.set(0, -0.13, -0.22);
      const lunateTail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.82, 0.30), yellowFinMat);
      lunateTail.position.set(0, 0, -0.52);
      tailPivot.add(peduncle, finletsTop, finletsBot, lunateTail);
      group.add(tailPivot);

      group.scale.setScalar(baseScale);
      tagBiotaHierarchy(group, 'YELLOWFIN_TUNA');
      biotaGroup.add(group);
      return { group, tailPivot, jawPivot, baseScale };
    }

    // -------------------------------------------------------------------------
    // 捕食衝擊水花環與浪沫飛濺特效 (Predation Strike Splash & Bite Ring)
    // -------------------------------------------------------------------------
    function buildPredationSplashEffect(ringColorHex, dropColorHex) {
      const group = new THREE.Group();
      group.visible = false;

      const ringGeo = new THREE.RingGeometry(0.25, 0.52, 20);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: ringColorHex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      group.add(ringMesh);

      const droplets = [];
      const dropMat = new THREE.MeshBasicMaterial({ color: dropColorHex, transparent: true, opacity: 0.9 });
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const drop = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), dropMat);
        group.add(drop);
        droplets.push({ mesh: drop, angle });
      }

      biotaGroup.add(group);
      return { group, ringMesh, ringMat, droplets };
    }

    function createReefFishModel(x, y, z) {
      const group = new THREE.Group();
      group.position.set(x, y, z);

      const yellowMat = new THREE.MeshLambertMaterial({ color: 0xfacc15 });
      const stripeMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });

      const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.32, 0.42), yellowMat);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.30, 0.10), stripeMat);
      stripe.position.z = 0.06;
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.16), yellowMat);
      tail.position.z = -0.26;

      group.add(body, stripe, tail);
      tagBiotaHierarchy(group, 'TURTLE');
      biotaGroup.add(group);
      biotaEntities.push({
        type: 'REEF_FISH',
        group,
        tail,
        originX: x,
        originY: y,
        originZ: z,
        phase: Math.random() * Math.PI * 2
      });
    }

    // Build 4 Coordinated Kuroshio Predation Squadrons along the Continental Shelf
    // 真正呈現「鬼頭刀追捕吃飛魚、黃鰭鮪魚追捕吃鬼頭刀」的三階掠食鏈！
    function initKuroshioMigrationSquads() {
      const squadLanes = [
        { baseX: 22.5, startZ: 24, phase: 0.0, predOffset: 0.0 },
        { baseX: 27.5, startZ: 8,  phase: 1.7, predOffset: 2.2 },
        { baseX: 24.0, startZ: -8, phase: 3.4, predOffset: 4.5 },
        { baseX: 31.0, startZ: -22,phase: 5.1, predOffset: 6.6 }
      ];

      squadLanes.forEach((lane, idx) => {
        // 1) 第一階獵物：4 尾飛魚 (其中第 3 尾 idx=2 會被鬼頭刀鎖定追咬吞食，隨後自上游補入新個體)
        const flyingFishUnits = [];
        const ffOffsets = [
          { dx: -1.1, dz: -1.4, phase: 0.0 },
          { dx:  0.9, dz: -0.8, phase: 0.8 },
          { dx: -0.3, dz:  0.5, phase: 1.5 }, // 鬼頭刀鎖定捕食目標！
          { dx:  1.2, dz:  0.2, phase: 2.2 }
        ];
        ffOffsets.forEach(off => {
          const meshObj = buildFlyingFishMesh();
          flyingFishUnits.push({ ...meshObj, ...off });
        });

        // 2) 第二階中層掠食者：2 尾鬼頭刀 (第 1 尾衝刺抓飛魚吃；第 2 尾亞成體則會被後方巨型黃鰭鮪魚鎖定突襲吃掉！)
        const mahiUnits = [
          { ...buildMahiMahiMesh(1.12), dx: -0.4, dz: 3.4, dy: -0.55, phase: 0.2 }, // 獵食飛魚的主力鬼頭刀
          { ...buildMahiMahiMesh(0.88), dx:  0.9, dz: 4.5, dy: -0.80, phase: 1.9 }  // 被巨型黃鰭鮪魚獵食的亞成體鬼頭刀
        ];

        // 3) 第三階頂級掠食者：2 尾巨型黃鰭鮪魚 (第 1 尾為 1.48x 巨物，從黑潮深處高速衝刺咬住並吞食鬼頭刀！)
        const tunaUnits = [
          { ...buildYellowfinTunaMesh(1.48), dx:  0.6, dz: 7.8, dy: -2.1, phase: 0.5 }, // 突襲吃鬼頭刀的巨型黃鰭鮪
          { ...buildYellowfinTunaMesh(1.32), dx: -1.1, dz: 9.0, dy: -2.8, phase: 2.4 }
        ];

        const mahiStrikeEffect = buildPredationSplashEffect(0x7dd3fc, 0xe0f2fe);
        const tunaStrikeEffect = buildPredationSplashEffect(0xfacc15, 0xfef08a);

        migrationSquads.push({
          idx,
          baseX: lane.baseX,
          z: lane.startZ,
          phase: lane.phase,
          predOffset: lane.predOffset,
          flyingFishUnits,
          mahiUnits,
          tunaUnits,
          mahiStrikeEffect,
          tunaStrikeEffect
        });
      });
    }

    // 讓學生可一鍵將鏡頭鎖定在「鬼頭刀抓飛魚吃」或「黃鰭鮪魚抓鬼頭刀吃」的掠食瞬間
    window.triggerPredationFocus = function (strikeType) {
      if (migrationSquads.length === 0) return;
      const leadSquad = migrationSquads[0];
      if (strikeType === 'MAHI_EATS_FF') {
        leadSquad.predOffset = (0.95 - (simTime % 8.5) + 8.5) % 8.5;
        activeFollowMode = 'MAHI_MAHI';
        if (typeof updateSpeciesInspectorUI === 'function') {
          updateSpeciesInspectorUI('MAHI_MAHI', leadSquad.baseX, seaLevel - 0.3, leadSquad.z + 1.5);
        }
        if (typeof animateCameraTo === 'function') {
          animateCameraTo(leadSquad.mahiUnits[0].group.position, 12.5, 1.15, 1.10);
        }
      } else if (strikeType === 'TUNA_EATS_MAHI') {
        leadSquad.predOffset = (4.55 - (simTime % 8.5) + 8.5) % 8.5;
        activeFollowMode = 'YELLOWFIN_TUNA';
        if (typeof updateSpeciesInspectorUI === 'function') {
          updateSpeciesInspectorUI('YELLOWFIN_TUNA', leadSquad.baseX, seaLevel - 1.5, leadSquad.z + 5.5);
        }
        if (typeof animateCameraTo === 'function') {
          animateCameraTo(leadSquad.tunaUnits[0].group.position, 14.0, 1.15, 1.12);
        }
      }
    };

    function initCoastalBiota() {
      for (let z = -28; z <= 28; z += 3) {
        const rx = 4 + Math.floor(hash2D(z, 11) * 10);
        const ry = getSurfaceY(rx, z) + 0.5;
        if (ry <= 1.2 && ry >= -3) createSeaweedModel(rx, ry, z, false);

        const kx = 14 + Math.floor(hash2D(z, 29) * 8);
        const ky = getSurfaceY(kx, z) + 0.5;
        if (ky <= -0.5 && ky >= -5) createSeaweedModel(kx, ky, z + 1, true);
      }

      const crabSpots = [
        [4, -22], [6, -19], [5, -15], [7, -10], [8, -7],
        [4, -2], [6, 3], [5, 8], [6, 13], [8, 16],
        [10, 18], [5, 14], [7, 15], [3, 6], [2, 2]
      ];
      crabSpots.forEach(([cx, cz]) => createCrabModel(cx, cz));

      const blennySpots = [
        [7, -21], [9, -17], [6, -11], [8, -4], [9, 2],
        [7, 7], [9, 11], [8, 15], [7, 19], [6, 24]
      ];
      blennySpots.forEach(([bx, bz]) => createBlennyModel(bx, bz));

      const clamSpots = [
        [11, -20], [13, -12], [12, -3], [14, 5], [13, 14], [16, 21], [15, 26]
      ];
      clamSpots.forEach(([cx, cz]) => createGiantClamModel(cx, cz));

      const urchinSpots = [
        [8, -23], [10, -14], [9, -5], [11, 4], [10, 11], [12, 18], [14, 24]
      ];
      urchinSpots.forEach(([ux, uz]) => createSeaUrchinModel(ux, uz));

      createSeaTurtleModel(18, -1.2, 16);
      createSeaTurtleModel(21, -1.8, 6);
      createSeaTurtleModel(17, -1.0, -16);
      createSeaTurtleModel(23, -2.2, -6);

      // Initialize the 3-tier Kuroshio predation chains (Flying Fish <- eaten by Mahi-mahi <- eaten by Yellowfin Tuna)
      initKuroshioMigrationSquads();

      for (let i = 0; i < 18; i++) {
        const rx = 14 + (i % 4) * 3.2;
        const rz = -26 + i * 3;
        const ry = Math.min(-1.2, getSurfaceY(rx, rz) + 1.5);
        createReefFishModel(rx, ry, rz);
      }
    }

    function updateSplashEffect(effectObj, x, y, z, progress) {
      if (progress <= 0 || progress >= 1 || z > currentSliceZ || z < WORLD_MIN_Z) {
        effectObj.group.visible = false;
        return;
      }
      effectObj.group.visible = true;
      effectObj.group.position.set(x, y, z);
      const ringScale = 0.6 + progress * 2.8;
      effectObj.ringMesh.scale.setScalar(ringScale);
      effectObj.ringMat.opacity = (1.0 - progress) * 0.9;

      const arcY = Math.sin(progress * Math.PI) * 1.15;
      const rad = 0.25 + progress * 1.35;
      effectObj.droplets.forEach((d, idx) => {
        d.mesh.position.set(
          Math.cos(d.angle + progress * 2.0) * rad,
          arcY + (idx % 2) * 0.22,
          Math.sin(d.angle + progress * 2.0) * rad
        );
        d.mesh.scale.setScalar(Math.max(0.1, 1.0 - progress * 0.8));
      });
    }

    function updateCoastalBiota(dt) {
      for (let i = 0; i < biotaEntities.length; i++) {
        const ent = biotaEntities[i];
        if (ent.group.position.z > currentSliceZ) {
          ent.group.visible = false;
          continue;
        }
        ent.group.visible = true;

        if (ent.type === 'SEAWEED') {
          const waveBend = Math.sin(wavePhaseTime * 1.45 + ent.baseX * 0.34 + ent.phase) * 0.28 * waveHeightMultiplier;
          for (let b = 0; b < ent.blades.length; b++) {
            ent.blades[b].rotation.z = waveBend + Math.sin(simTime * 1.5 + b) * 0.08;
            ent.blades[b].rotation.x = Math.cos(simTime * 1.1 + b) * 0.10;
          }
        }
        else if (ent.type === 'CRAB') {
          const scuttle = Math.sin(simTime * ent.speed + ent.phase) * 0.95;
          const cx = ent.originX + scuttle * 0.4;
          const cz = ent.originZ + Math.cos(simTime * ent.speed * 0.65 + ent.phase) * 0.55;
          const cy = getSurfaceY(cx, cz) + 0.52;
          ent.group.position.set(cx, cy, cz);
          ent.group.rotation.y = Math.sin(simTime * 0.5 + ent.phase) * 0.35;

          const clawAngle = Math.sin(simTime * 2.4 + ent.phase) * 0.3;
          ent.clawLPivot.rotation.y = clawAngle;
          ent.clawRPivot.rotation.y = -clawAngle;
          ent.clawLPivot.rotation.x = -0.2 + Math.sin(simTime * 1.8) * 0.15;
          ent.clawRPivot.rotation.x = -0.2 + Math.cos(simTime * 1.8) * 0.15;

          ent.legs.forEach(leg => {
            leg.pivot.rotation.z = Math.sin(simTime * 5.5 + leg.idx * 1.5 + leg.side) * 0.24;
          });
        }
        else if (ent.type === 'BLENNY') {
          ent.tailPivot.rotation.y = Math.sin(simTime * 6.5 + ent.phase) * 0.38;
          const hopCycle = Math.sin(simTime * 1.6 + ent.phase);
          const hopY = hopCycle > 0.72 ? (hopCycle - 0.72) * 1.1 : 0;
          const bx = ent.originX + Math.cos(simTime * 0.85 + ent.phase) * 0.55;
          const bz = ent.originZ + Math.sin(simTime * 0.85 + ent.phase) * 0.55;
          ent.group.position.set(bx, ent.originY + hopY, bz);
          ent.group.rotation.y = -(simTime * 0.85 + ent.phase);
        }
        else if (ent.type === 'CLAM') {
          const openAmt = 0.16 + (Math.sin(simTime * 0.9 + ent.phase) + 1) * 0.12;
          ent.leftValve.rotation.z = openAmt;
          ent.rightValve.rotation.z = -openAmt;
          ent.mantle.scale.x = 0.85 + openAmt * 1.1;
        }
        else if (ent.type === 'URCHIN') {
          ent.group.rotation.y = simTime * 0.25 + ent.phase;
          ent.group.rotation.z = Math.sin(simTime * 1.2 + ent.phase) * 0.08;
        }
        else if (ent.type === 'TURTLE') {
          ent.angle += dt * 0.32;
          const tx = ent.centerX + Math.cos(ent.angle) * ent.radius;
          const tz = ent.centerZ + Math.sin(ent.angle) * ent.radius;
          const ty = Math.min(seaLevel - 0.35, ent.centerY + Math.sin(simTime * 0.8 + ent.angle) * 0.45);
          ent.group.position.set(tx, ty, tz);
          ent.group.rotation.y = -ent.angle;
          ent.group.rotation.x = Math.cos(simTime * 0.8 + ent.angle) * 0.08;

          const flap = Math.sin(simTime * 2.2 + ent.angle) * 0.45;
          ent.flipperL.rotation.z = flap;
          ent.flipperR.rotation.z = -flap;
        }
        else if (ent.type === 'REEF_FISH') {
          const angle = simTime * 1.05 + ent.phase;
          ent.group.position.set(
            ent.originX + Math.cos(angle) * 1.2,
            Math.min(seaLevel - 0.5, ent.originY + Math.sin(simTime * 1.5 + ent.phase) * 0.28),
            ent.originZ + Math.sin(angle) * 1.2
          );
          ent.group.rotation.y = -angle;
          ent.tail.rotation.y = Math.sin(simTime * 8 + ent.phase) * 0.35;
        }
      }

      // -----------------------------------------------------------------------
      // Update 3-Tier Kuroshio Predation Squadrons:
      // 階段 A (predT = 1.0..3.4s)：鬼頭刀高速衝刺、張大嘴咬住飛魚並吞食！
      // 階段 B (predT = 4.6..7.4s)：大型黃鰭鮪魚從黑潮中深層高速突襲、張嘴咬住鬼頭刀並吞食！
      // -----------------------------------------------------------------------
      const seaStateDrive = 0.65 + waveSpeedMultiplier * 0.85 + waveHeightMultiplier * 0.25;
      const migrationSpeed = 2.6 * seaStateDrive;

      migrationSquads.forEach(squad => {
        squad.z -= migrationSpeed * dt;
        if (squad.z < WORLD_MIN_Z - 6) {
          squad.z = WORLD_MAX_Z - 4;
        }

        const squadSwayX = Math.sin(simTime * 0.9 + squad.phase) * 1.6;
        // 8.5 秒完整三階掠食循環
        const predT = (simTime + squad.predOffset) % 8.5;

        // 1. 先計算所有飛魚的自然巡游/滑翔位置
        squad.flyingFishUnits.forEach((ff, ffIdx) => {
          const wz = squad.z + ff.dz;
          const wx = squad.baseX + squadSwayX + ff.dx + Math.sin(simTime * 2.2 + ff.phase) * 0.45;
          const inBounds = wz <= currentSliceZ && wz >= WORLD_MIN_Z;

          // 被鬼頭刀鎖定的目標飛魚 (ffIdx === 2) 在 predT = 1.0..2.2s 時落回水面準備被捕食
          const leapTrigger = (ffIdx === 2 && predT >= 0.8 && predT <= 3.8)
            ? -0.25
            : Math.sin(simTime * 1.45 + squad.phase + ff.phase * 0.4);
          const isGliding = leapTrigger > -0.05;
          const maxGlideH = 1.45 * Math.max(0.7, waveHeightMultiplier);
          const wy = isGliding
            ? seaLevel + 0.42 + Math.sin(((leapTrigger + 0.05) / 1.05) * Math.PI) * maxGlideH
            : seaLevel - 0.42 + leapTrigger * 0.25;

          ff.group.visible = inBounds;
          ff.group.scale.setScalar(1.0);
          ff.group.position.set(wx, wy, wz);
          ff.group.rotation.set(isGliding ? -0.15 : 0.05, Math.PI + Math.cos(simTime * 2.2 + ff.phase) * 0.12, 0);

          const wingSpread = isGliding ? Math.sin(simTime * 12) * 0.10 : -0.45;
          ff.wingL.rotation.z = wingSpread;
          ff.wingR.rotation.z = -wingSpread;
          ff.tail.rotation.y = Math.sin(simTime * 11 + ff.phase) * 0.35;
        });

        // 2. 更新鬼頭刀 (mahiUnits[0] 追捕吃掉 flyingFishUnits[2]；mahiUnits[1] 則在階段 B 被黃鰭鮪魚追捕吃掉)
        const preyFF = squad.flyingFishUnits[2];
        let mahiSplashProg = 0;

        squad.mahiUnits.forEach((mahi, mIdx) => {
          let wx = squad.baseX + squadSwayX + mahi.dx + Math.sin(simTime * 2.8 + mahi.phase) * 0.65;
          let wy = seaLevel + mahi.dy + Math.sin(simTime * 2.0 + mahi.phase) * 0.20;
          let wz = squad.z + mahi.dz;
          let pitchX = 0;
          let jawOpen = 0.06 + Math.sin(simTime * 4.0 + mahi.phase) * 0.04;
          let tailSpeed = 11.5;

          // 主力鬼頭刀 (mIdx === 0) 衝刺抓飛魚吃！(predT = 1.0 .. 3.4s)
          if (mIdx === 0) {
            if (predT >= 1.0 && predT < 1.95) {
              // 高速衝刺撲向目標飛魚 (preyFF)
              const p = (predT - 1.0) / 0.95;
              const ease = p * p * (3 - 2 * p);
              wx = THREE.MathUtils.lerp(wx, preyFF.group.position.x, ease);
              wy = THREE.MathUtils.lerp(wy, preyFF.group.position.y - 0.05, ease);
              wz = THREE.MathUtils.lerp(wz, preyFF.group.position.z + 0.55, ease);
              pitchX = Math.sin(p * Math.PI) * 0.28;
              jawOpen = ease * 0.62; // 張大嘴準備咬合！
              tailSpeed = 22.0;
            } else if (predT >= 1.95 && predT < 2.85) {
              // 咬住飛魚並吞入口中！
              const swallowP = (predT - 1.95) / 0.90;
              wx = preyFF.group.position.x;
              wy = preyFF.group.position.y - 0.02;
              wz = preyFF.group.position.z + 0.45 * (1 - swallowP * 0.5);
              pitchX = 0.12 * Math.sin(swallowP * Math.PI * 3);
              jawOpen = 0.15 + Math.abs(Math.sin(swallowP * Math.PI * 4)) * 0.45; // 連續咀嚼吞嚥
              tailSpeed = 18.0;
              mahiSplashProg = swallowP;

              // 飛魚被鬼頭刀咬在嘴裡掙扎並縮小吞入腹中！
              preyFF.group.position.set(wx, wy + 0.04, wz - 0.52 * (1 - swallowP * 0.65));
              preyFF.group.rotation.z = Math.sin(simTime * 38) * 0.85;
              preyFF.group.scale.setScalar(Math.max(0.02, 1.0 - swallowP * 0.98));
            } else if (predT >= 2.85 && predT < 3.65) {
              // 飛魚已被吞食完畢，鬼頭刀退回巡弋隊形，新飛魚自前方漸現補位
              const recoverP = (predT - 2.85) / 0.80;
              wx = THREE.MathUtils.lerp(preyFF.group.position.x, wx, recoverP);
              wy = THREE.MathUtils.lerp(preyFF.group.position.y, wy, recoverP);
              wz = THREE.MathUtils.lerp(preyFF.group.position.z + 0.3, wz, recoverP);
              if (recoverP < 0.55) {
                preyFF.group.visible = false;
              } else {
                preyFF.group.scale.setScalar((recoverP - 0.55) / 0.45);
              }
            }
          }

          mahi.group.visible = wz <= currentSliceZ && wz >= WORLD_MIN_Z;
          mahi.group.scale.setScalar(mahi.baseScale);
          mahi.group.position.set(wx, wy, wz);
          mahi.group.rotation.set(pitchX, Math.PI + Math.cos(simTime * 2.8 + mahi.phase) * 0.18, 0);
          mahi.jawPivot.rotation.x = jawOpen;
          mahi.tailPivot.rotation.y = Math.sin(simTime * tailSpeed * seaStateDrive + mahi.phase) * 0.45;
        });

        updateSplashEffect(
          squad.mahiStrikeEffect,
          squad.mahiUnits[0].group.position.x,
          seaLevel + 0.08,
          squad.mahiUnits[0].group.position.z - 0.45,
          mahiSplashProg
        );

        // 3. 更新大型黃鰭鮪魚 (tunaUnits[0] 從黑潮深層高速衝刺抓鬼頭刀 mahiUnits[1] 吃！)
        const preyMahi = squad.mahiUnits[1];
        let tunaSplashProg = 0;

        squad.tunaUnits.forEach((tuna, tIdx) => {
          let wx = squad.baseX + squadSwayX * 0.7 + tuna.dx + Math.sin(simTime * 1.6 + tuna.phase) * 0.55;
          let wy = seaLevel + tuna.dy - (waveHeightMultiplier > 1.2 ? 0.4 : 0) + Math.cos(simTime * 1.4 + tuna.phase) * 0.25;
          let wz = squad.z + tuna.dz;
          let pitchX = 0;
          let jawOpen = 0.05 + Math.sin(simTime * 3.2 + tuna.phase) * 0.03;
          let tailSpeed = 9.0;

          // 巨型黃鰭鮪魚 (tIdx === 0) 在 predT = 4.6 .. 7.4s 突襲抓鬼頭刀吃！
          if (tIdx === 0) {
            if (predT >= 4.6 && predT < 5.65) {
              // 從黑潮深處高速向上衝刺撲向鬼頭刀 (preyMahi)
              const p = (predT - 4.6) / 1.05;
              const ease = p * p * (3 - 2 * p);
              wx = THREE.MathUtils.lerp(wx, preyMahi.group.position.x, ease);
              wy = THREE.MathUtils.lerp(wy, preyMahi.group.position.y - 0.06, ease);
              wz = THREE.MathUtils.lerp(wz, preyMahi.group.position.z + 0.95, ease);
              pitchX = Math.sin(p * Math.PI) * 0.36; // 仰角高速上衝
              jawOpen = ease * 0.68; // 巨顎大張！
              tailSpeed = 20.0;
            } else if (predT >= 5.65 && predT < 6.65) {
              // 咬住鬼頭刀並吞入巨口中！
              const swallowP = (predT - 5.65) / 1.00;
              wx = preyMahi.group.position.x;
              wy = preyMahi.group.position.y - 0.04;
              wz = preyMahi.group.position.z + 0.75 * (1 - swallowP * 0.5);
              pitchX = 0.14 * Math.sin(swallowP * Math.PI * 3);
              jawOpen = 0.18 + Math.abs(Math.sin(swallowP * Math.PI * 4)) * 0.48; // 猛烈咬合吞食鬼頭刀
              tailSpeed = 17.0;
              tunaSplashProg = swallowP;

              // 被咬住的鬼頭刀在黃鰭鮪魚巨口前劇烈掙扎並縮小被吞食！
              preyMahi.group.position.set(wx, wy + 0.03, wz - 0.95 * (1 - swallowP * 0.68));
              preyMahi.group.rotation.z = Math.sin(simTime * 32) * 0.75;
              preyMahi.group.scale.setScalar(Math.max(0.02, preyMahi.baseScale * (1.0 - swallowP * 0.98)));
            } else if (predT >= 6.65 && predT < 7.60) {
              // 鬼頭刀已被黃鰭鮪魚吞食，黃鰭鮪魚潛回深層，新鬼頭刀自上游補位
              const recoverP = (predT - 6.65) / 0.95;
              wx = THREE.MathUtils.lerp(preyMahi.group.position.x, wx, recoverP);
              wy = THREE.MathUtils.lerp(preyMahi.group.position.y, wy, recoverP);
              wz = THREE.MathUtils.lerp(preyMahi.group.position.z + 0.6, wz, recoverP);
              if (recoverP < 0.55) {
                preyMahi.group.visible = false;
              } else {
                preyMahi.group.scale.setScalar(preyMahi.baseScale * ((recoverP - 0.55) / 0.45));
              }
            }
          }

          tuna.group.visible = wz <= currentSliceZ && wz >= WORLD_MIN_Z;
          tuna.group.position.set(wx, wy, wz);
          tuna.group.rotation.set(pitchX, Math.PI + Math.cos(simTime * 1.6 + tuna.phase) * 0.14, 0);
          tuna.jawPivot.rotation.x = jawOpen;
          tuna.tailPivot.rotation.y = Math.sin(simTime * tailSpeed * seaStateDrive + tuna.phase) * 0.38;
        });

        updateSplashEffect(
          squad.tunaStrikeEffect,
          squad.tunaUnits[0].group.position.x,
          squad.tunaUnits[0].group.position.y + 0.15,
          squad.tunaUnits[0].group.position.z - 0.85,
          tunaSplashProg
        );
      });

      // 即時更新 UI 上的黑潮三階掠食狀態標籤
      if (migrationSquads.length > 0 && typeof setMigrationBadge === 'function') {
        const leadPredT = (simTime + migrationSquads[0].predOffset) % 8.5;
        if (leadPredT >= 1.0 && leadPredT < 3.0) {
          setMigrationBadge('⚡ 鬼頭刀正衝刺抓飛魚吃！', true);
        } else if (leadPredT >= 4.6 && leadPredT < 6.8) {
          setMigrationBadge('⚡ 黃鰭鮪正突襲抓鬼頭刀吃！', true);
        } else if (activeFollowMode) {
          setMigrationBadge('🌊 黑潮三階掠食鏈伴游中', true);
        } else {
          setMigrationBadge('🌊 飛魚 ➔ 鬼頭刀 ➔ 黃鰭鮪掠食中', false);
        }
      }

      // If Follow-Cam is active, smoothly track the primary migration squadron (#0)!
      if (activeFollowMode && controlMode === 'ORBIT' && migrationSquads.length > 0) {
        const leadSquad = migrationSquads[0];
        const leadPredT = (simTime + leadSquad.predOffset) % 8.5;
        const targetPos = new THREE.Vector3();
        if (activeFollowMode === 'FLYING_FISH') {
          targetPos.copy(leadSquad.flyingFishUnits[0].group.position);
        } else if (activeFollowMode === 'MAHI_MAHI') {
          targetPos.copy(leadSquad.mahiUnits[0].group.position);
        } else if (activeFollowMode === 'YELLOWFIN_TUNA') {
          targetPos.copy(leadSquad.tunaUnits[0].group.position);
        } else {
          // MIGRATION_CHAIN: 自動跟隨當下正在發生的掠食焦點（鬼頭刀吃飛魚 vs 黃鰭鮪吃鬼頭刀）
          if (leadPredT >= 0.8 && leadPredT < 3.5) {
            targetPos.copy(leadSquad.mahiUnits[0].group.position);
          } else if (leadPredT >= 4.4 && leadPredT < 7.4) {
            targetPos.copy(leadSquad.tunaUnits[0].group.position);
          } else {
            targetPos.set(
              leadSquad.baseX + Math.sin(simTime * 0.9 + leadSquad.phase) * 1.2,
              seaLevel - 0.8,
              leadSquad.z + 3.8
            );
          }
        }
        orbitTarget.lerp(targetPos, 0.12);
        updateOrbitCamera();
      }
    }

