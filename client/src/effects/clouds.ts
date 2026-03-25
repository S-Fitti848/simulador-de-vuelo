import * as THREE from 'three';

/**
 * Crea una capa de nubes procedurales usando grupos de esferas semi-transparentes.
 * Las nubes se distribuyen aleatoriamente en un campo de 40km a 800-1800m de altitud.
 */
export function createCloudLayer(scene: THREE.Scene) {
  const mat = new THREE.MeshLambertMaterial({
    color:       0xffffff,
    transparent: true,
    opacity:     0.82,
    depthWrite:  false,
  });

  const FIELD   = 20000;  // semiancho del campo (m)
  const ALT_MIN = 800;
  const ALT_MAX = 1800;
  const CLUSTERS = 45;

  for (let i = 0; i < CLUSTERS; i++) {
    const cluster  = new THREE.Group();
    const nPuffs   = 3 + Math.floor(Math.random() * 5);

    for (let j = 0; j < nPuffs; j++) {
      const r    = 55 + Math.random() * 110;
      const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 7, 5), mat);
      puff.position.set(
        (Math.random() - 0.5) * 200,
        (Math.random() - 0.5) * 50,
        (Math.random() - 0.5) * 200,
      );
      cluster.add(puff);
    }

    cluster.position.set(
      (Math.random() - 0.5) * FIELD * 2,
      ALT_MIN + Math.random() * (ALT_MAX - ALT_MIN),
      (Math.random() - 0.5) * FIELD * 2,
    );
    cluster.rotation.y = Math.random() * Math.PI * 2;
    scene.add(cluster);
  }
}
