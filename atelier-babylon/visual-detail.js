/* Les Rangs du Nord — visual detail preview 0.2.
 * Additive rendering layer for the ORIGINAL Babylon workshop.
 * Does not change motion-core.js, appuis, commands, or the main game.
 * All textures and meshes are built in code. No external asset downloads.
 */
(function (global) {
  'use strict';
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  function seeded(seed) {
    return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  }
  function groundColor(x, z, noise) {
    const edge = 1.05 + .13 * Math.sin(z * .45) + .08 * Math.cos(z * 1.8);
    const path = 1 - clamp((Math.abs(x) - edge) / .75, 0, 1);
    const patch = Math.sin(x * .9 + Math.cos(z * .3)) * 4 + Math.cos(z * 1.7) * 2;
    const grain = (noise - .5) * 19 + patch;
    return [62 + path * 32 + grain, 74 + path * 12 + grain, 48 + path * 16 + grain].map(n => clamp(Math.round(n), 0, 255));
  }
  // Cloth coordinates relative to the existing torso. The upper seam stays fixed.
  function capePoint(u, v, time, speed) {
    const w = .42 + .20 * v;
    return [(u - .5) * w,
      .23 - .74 * v + Math.cos(u * Math.PI * 6) * .011 * v,
      -.235 - .065 * v - Math.sin(u * Math.PI * 8) * (.01 + v * .016)
        - Math.min(speed, 2.4) * .07 * v * v
        + Math.sin(time * 2.7 + u * 4 + v * 5) * .018 * v * v];
  }
  function capeData(time, speed, cols = 12, rows = 16) {
    const positions = [], uvs = [], indices = [];
    for (let y = 0; y <= rows; y++) for (let x = 0; x <= cols; x++) {
      positions.push(...capePoint(x / cols, y / rows, time, speed));
      uvs.push(x / cols, 1 - y / rows);
    }
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const a = y * (cols + 1) + x, b = a + cols + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
    return { positions, uvs, indices };
  }
  global.RDNVisualMath = { seeded, groundColor, capePoint, capeData };

  function install(workshop, B) {
    const view = workshop && workshop.renderer;
    if (!view || view.kind !== 'babylon' || !B) throw new Error('Le rendu Babylon doit être chargé.');
    if (view.visualDetails) return view.visualDetails;
    const scene = view.scene, owned = [], restores = [];
    const mat = name => scene.getMaterialByName(name);
    const mesh = name => scene.getMeshByName(name);
    const remember = (obj, key, value) => {
      if (!obj) return;
      const old = obj[key]; restores.push(() => { obj[key] = old; }); obj[key] = value;
    };
    function texture(name, size, paint) {
      const t = new B.DynamicTexture('rdn-detail-' + name, { width: size, height: size }, scene, true);
      owned.push(t); paint(t.getContext(), size, seeded(name.length * 773 + 26));
      t.update(false); t.anisotropicFilteringLevel = 4; return t;
    }
    function grainTexture(name, color, kind) {
      return texture(name, 256, (c, s, random) => {
        c.fillStyle = color; c.fillRect(0, 0, s, s);
        for (let i = 0; i < 7000; i++) {
          c.fillStyle = i % 2 ? 'rgba(255,244,211,.07)' : 'rgba(12,17,12,.10)';
          const x = random() * s, y = random() * s;
          c.fillRect(x, y, kind === 'wood' ? 1 : 2, kind === 'wood' ? 2 + random() * 26 : 1);
        }
        if (kind === 'cloth') {
          c.lineWidth = 1; c.strokeStyle = 'rgba(233,222,188,.11)'; c.beginPath();
          for (let i = 0; i < s; i += 4) { c.moveTo(i, 0); c.lineTo(i, s); c.moveTo(0, i); c.lineTo(s, i); }
          c.stroke();
        }
        if (kind === 'wood') {
          c.strokeStyle = 'rgba(32,23,16,.23)'; c.lineWidth = 1;
          for (let x = 5; x < s; x += 12) {
            c.beginPath(); c.moveTo(x, 0); c.bezierCurveTo(x + 8, 84, x - 8, 168, x, s); c.stroke();
          }
        }
      });
    }
    function surface(name, color, kind, roughness, metallic) {
      const m = mat(name); if (!m) return;
      remember(m, 'albedoTexture', grainTexture(name, color, kind));
      remember(m, 'albedoColor', B.Color3.White());
      remember(m, 'roughness', roughness); remember(m, 'metallic', metallic);
    }
    let cape = null, grass = null, observer = null;
    try {
      surface('cloth', '#546051', 'cloth', .97, 0);
      surface('red', '#783e35', 'cloth', .98, 0);
      surface('leather', '#584030', 'leather', .88, 0);
      surface('wood', '#87623f', 'wood', .94, 0);
      surface('steel', '#9da6a1', 'metal', .56, .65);
      surface('stone', '#626a58', 'stone', 1, 0);
      const soil = texture('ground', 1024, (c, s, random) => {
        const pixels = c.createImageData(s, s), data = pixels.data;
        for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
          const rgb = groundColor((x / s - .5) * 80, (y / s - .5) * 80, random()), i = (y * s + x) * 4;
          data[i] = rgb[0]; data[i + 1] = rgb[1]; data[i + 2] = rgb[2]; data[i + 3] = 255;
        }
        c.putImageData(pixels, 0, 0);
      });
      remember(mat('ground'), 'albedoTexture', soil);
      remember(mat('ground'), 'albedoColor', B.Color3.White());
      remember(mat('ground'), 'roughness', 1);

      // A draped, low-poly cape replaces ONLY the visual box, not its controller.
      const torso = scene.getTransformNodeByName('torso'), oldCape = mesh('short cape');
      if (torso && oldCape) {
        const data = capeData(0, 0), vd = new B.VertexData();
        cape = new B.Mesh('rdn-draped-cape', scene); owned.push(cape);
        vd.positions = data.positions; vd.indices = data.indices; vd.uvs = data.uvs; vd.normals = [];
        B.VertexData.ComputeNormals(vd.positions, vd.indices, vd.normals); vd.applyToMesh(cape, true);
        const cm = mat('red').clone('rdn-cape-material'); owned.push(cm); cm.backFaceCulling = false;
        cape.material = cm; cape.parent = torso; cape.isPickable = false;
        remember(oldCape, 'visibility', 0);
        const shadows = scene.getLightByName('sun').getShadowGenerator();
        if (shadows) { shadows.addShadowCaster(cape); restores.push(() => shadows.removeShadowCaster(cape)); }
      }

      // A single grass mesh, not hundreds of animated scene nodes.
      const random = seeded(82917), pos = [], colors = [], idx = [];
      for (let i = 0; i < 1100; i++) {
        const x = (random() > .5 ? 1 : -1) * (1.45 + random() * 11), z = -11 + random() * 33;
        const h = .035 + random() * .16, w = .016 + random() * .02, a = random() * Math.PI;
        const dx = Math.cos(a) * w, dz = Math.sin(a) * w, n = pos.length / 3;
        pos.push(x - dx, .006, z - dz, x + dx, .006, z + dz, x + .03, h, z + .035);
        const g = .21 + random() * .13;
        colors.push(g * .86, g, g * .53, 1, g * .86, g, g * .53, 1, g * 1.25, g * 1.28, g * .68, 1);
        idx.push(n, n + 1, n + 2);
      }
      grass = new B.Mesh('rdn-grass-verges', scene); owned.push(grass);
      const gd = new B.VertexData(); gd.positions = pos; gd.indices = idx; gd.colors = colors; gd.normals = [];
      B.VertexData.ComputeNormals(pos, idx, gd.normals); gd.applyToMesh(grass, true);
      const gm = new B.StandardMaterial('rdn-grass-material', scene); owned.push(gm);
      gm.diffuseColor = B.Color3.White(); gm.specularColor = B.Color3.Black(); gm.backFaceCulling = false;
      grass.material = gm; grass.isPickable = false; grass.receiveShadows = true;
      const grassBase = pos.slice(); let slope = NaN, previousTime = -1;
      observer = scene.onBeforeRenderObservable.add(() => {
        const ctl = workshop.motion;
        if (cape && ctl.time !== previousTime) {
          const data = capeData(ctl.time, ctl.speed), normals = [];
          B.VertexData.ComputeNormals(data.positions, data.indices, normals);
          cape.updateVerticesData(B.VertexBuffer.PositionKind, data.positions);
          cape.updateVerticesData(B.VertexBuffer.NormalKind, normals);
          previousTime = ctl.time;
        }
        if (ctl.slope !== slope) {
          slope = ctl.slope;
          for (let i = 0; i < pos.length; i += 3) pos[i + 1] = grassBase[i + 1] + grassBase[i + 2] * slope;
          grass.updateVerticesData(B.VertexBuffer.PositionKind, pos, true);
        }
      });
      view.visualDetails = { version: '0.2.0', dispose };
      return view.visualDetails;
    } catch (error) { dispose(); throw error; }

    function dispose() {
      if (observer) scene.onBeforeRenderObservable.remove(observer);
      restores.reverse().forEach(fn => { try { fn(); } catch (_) {} });
      owned.reverse().forEach(o => { try { o.dispose(); } catch (_) {} });
      delete view.visualDetails;
    }
  }
  global.RDNVisualPass = { install, version: '0.2.0' };
})(globalThis);
