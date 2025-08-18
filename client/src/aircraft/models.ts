import * as THREE from 'three';

const darkMat = new THREE.MeshStandardMaterial({ color: 0x444444, flatShading: true });
const lightMat = new THREE.MeshStandardMaterial({ color: 0x777777, flatShading: true });
const emissiveMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });

export function buildRaptorLike(material: THREE.Material = darkMat): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 5), material);
  g.add(body);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(4, 0.05, 2.2), lightMat);
  wing.position.set(0, -0.1, 0);
  g.add(wing);
  const tailL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1, 0.8), lightMat);
  tailL.position.set(-0.6, 0.5, -2.2);
  tailL.rotation.set(0, 0, THREE.MathUtils.degToRad(25));
  g.add(tailL);
  const tailR = tailL.clone();
  tailR.position.x = 0.6;
  tailR.rotation.z = THREE.MathUtils.degToRad(-25);
  g.add(tailR);
  const navL = new THREE.Mesh(new THREE.SphereGeometry(0.05), emissiveMat);
  navL.position.set(-2, 0, 0);
  const navR = navL.clone();
  navR.position.x = 2;
  g.add(navL, navR);
  return g;
}

export function buildDragonLike(material: THREE.Material = darkMat): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.3, 5.5), material);
  g.add(body);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.05, 2.4), lightMat);
  wing.position.set(0, -0.1, -0.5);
  g.add(wing);
  const canard = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.8), lightMat);
  canard.position.set(0, 0.1, 1.2);
  g.add(canard);
  const tailL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.1, 0.9), lightMat);
  tailL.position.set(-0.6, 0.5, -2.5);
  tailL.rotation.set(0, 0, THREE.MathUtils.degToRad(25));
  const tailR = tailL.clone();
  tailR.position.x = 0.6;
  tailR.rotation.z = THREE.MathUtils.degToRad(-25);
  g.add(tailL, tailR);
  const navL = new THREE.Mesh(new THREE.SphereGeometry(0.05), emissiveMat);
  navL.position.set(-1.8, 0, -0.3);
  const navR = navL.clone();
  navR.position.x = 1.8;
  g.add(navL, navR);
  return g;
}

