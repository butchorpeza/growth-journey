import RAPIER from '@dimforge/rapier3d-compat';
await RAPIER.init();
const run = (label, setup) => {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(20, 0.5, 20).setTranslation(0, -0.5, 0));
  setup(world);
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 0.9, 2));
  const col = world.createCollider(RAPIER.ColliderDesc.capsule(0.58, 0.32), body);
  const c = world.createCharacterController(0.01);
  c.setUp({ x: 0, y: 1, z: 0 }); c.setMaxSlopeClimbAngle(46 * Math.PI / 180); c.setMinSlopeSlideAngle(50 * Math.PI / 180);
  c.enableAutostep(0.38, 0.2, true); c.enableSnapToGround(0.35);
  world.step();
  let vy = 0, vz = 0;
  for (let i = 0; i < 180; i++) {
    const dt = 1 / 60; vy -= 22 * dt;
    vz += (-1.7 - vz) * (1 - Math.exp(-10 * dt));
    const want = vz * dt;
    c.computeColliderMovement(col, { x: 0, y: vy * dt, z: want });
    const m = c.computedMovement();
    if (process.env.COLLAPSE && Math.abs(m.z) < Math.abs(want) * 0.5) vz = m.z / dt; if (c.computedGrounded() && vy < 0) vy = -0.5;
    const p = body.translation(); body.setNextKinematicTranslation({ x: p.x + m.x, y: p.y + m.y, z: p.z + m.z }); world.step();
  }
  const p = body.translation(); console.log(label, 'pos', p.x.toFixed(2), (p.y - 0.9).toFixed(2), p.z.toFixed(2));
};
run('stairs', (w) => { for (let i = 0; i < 8; i++) w.createCollider(RAPIER.ColliderDesc.cuboid(1.5, 0.17 * (i + 1) / 2, 0.15).setTranslation(0, 0.17 * (i + 1) / 2, -0.15 - 0.3 * i)); });
run('ramp30', (w) => { const a = 30 * Math.PI / 180; w.createCollider(RAPIER.ColliderDesc.cuboid(1.5, 0.1, 4).setTranslation(0, Math.sin(a) * 4 - 0.1, -Math.cos(a) * 4).setRotation({ x: Math.sin(a / 2), y: 0, z: 0, w: Math.cos(a / 2) })); });
