const VISTAS = {
  corpo: { altura: 1.02, distancia: 3.65, minimo: 2.65, maximo: 5.1 },
  rosto: { altura: 1.72, distancia: 1.55, minimo: 1.18, maximo: 2.65 },
};
const ANGULOS_INICIAIS = [0, 30, 330, 60, 300, 90, 270, 120, 240, 150, 210, 180];

export function cameraInicial(p) {
  return { origem: { ...p.location }, frente: p.getRotation().y, modo: "corpo", angulo: 0, zoom: 0 };
}

export function enquadrarCamera(c) {
  const { altura, distancia, minimo, maximo } = VISTAS[c.modo];
  const d = Math.max(minimo, Math.min(maximo, distancia + c.zoom * 0.38));
  const theta = (c.frente + c.angulo) * Math.PI / 180;
  const foco = { x: c.origem.x, y: c.origem.y + altura, z: c.origem.z };
  return { foco, direcao: { x: -Math.sin(theta), y: 0, z: Math.cos(theta) }, d, minimo };
}

export function posicionarCamera(p, c, animar = false) {
  const { foco, direcao, d, minimo } = enquadrarCamera(c);
  const colisao = p.dimension.getBlockFromRay?.(foco, direcao, { maxDistance: d, includePassableBlocks: false });
  let distancia = d;
  if (colisao) {
    const b = colisao.block.location;
    const f = colisao.faceLocation;
    distancia = Math.min(d, Math.hypot(b.x + f.x - foco.x, b.z + f.z - foco.z) - 0.28);
    if (distancia < minimo) return false;
  }
  const location = { x: foco.x + direcao.x * distancia, y: foco.y, z: foco.z + direcao.z * distancia };
  const opcoes = { location, facingLocation: foco };
  if (animar) opcoes.easeOptions = { easeTime: 0.18 };
  p.camera.setCamera("minecraft:free", opcoes);
  return true;
}

export function buscarCameraInicial(p, camera) {
  if (!p.isOnGround) return undefined;
  for (const angulo of ANGULOS_INICIAIS) {
    const tentativa = { ...camera, angulo };
    try {
      if (posicionarCamera(p, tentativa)) return tentativa;
    } catch {}
  }
}

export function atualizarCamera(sessao, alteracoes) {
  const nova = { ...sessao.camera, ...alteracoes };
  try {
    if (!posicionarCamera(sessao.p, nova, true)) return false;
  } catch { return false; }
  sessao.camera = nova;
  return true;
}
