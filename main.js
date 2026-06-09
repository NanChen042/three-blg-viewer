import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const THREE_VERSION = "0.165.0";
const PROJECT_MODEL_URL = "assets/models/yellow_onion_2k.gltf/yellow_onion_2k.gltf";
const PROJECT_MODEL_LABEL = "黄洋葱 2K 材质模型";

const stage = document.querySelector("#stage");
const shell = document.querySelector(".viewer-shell");
const fileInput = document.querySelector("#fileInput");
const openModelButton = document.querySelector("#openModelButton");
const resetViewButton = document.querySelector("#resetViewButton");
const defaultModelButton = document.querySelector("#defaultModelButton");
const autoRotateToggle = document.querySelector("#autoRotateToggle");
const wireframeToggle = document.querySelector("#wireframeToggle");
const speedRange = document.querySelector("#speedRange");
const exposureRange = document.querySelector("#exposureRange");
const keyLightRange = document.querySelector("#keyLightRange");
const environmentRange = document.querySelector("#environmentRange");
const modelName = document.querySelector("#modelName");
const statusText = document.querySelector("#statusText");
const loadingOverlay = document.querySelector("#loadingOverlay");
const loadingText = document.querySelector("#loadingText");
const controlsPanel = document.querySelector("#controlsPanel");
const panelToggleButton = document.querySelector("#panelToggleButton");
const panelBody = document.querySelector("#panelBody");
const ambientAudio = document.querySelector("#ambientAudio");
const playAudioButton = document.querySelector("#playAudioButton");
const audioStatus = document.querySelector("#audioStatus");
const audioProgress = document.querySelector("#audioProgress");
const audioCurrentTime = document.querySelector("#audioCurrentTime");
const audioDuration = document.querySelector("#audioDuration");
const audioVolume = document.querySelector("#audioVolume");

const AUDIO_DURATION = 36;
const AUDIO_SAMPLE_RATE = 22050;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101110);
scene.fog = new THREE.Fog(0x101110, 12, 32);

const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 120);
camera.position.set(4.8, 3.2, 6.4);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(stage.clientWidth, stage.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = Number(exposureRange.value);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 1.6;
controls.maxDistance = 28;
controls.target.set(0, 0.6, 0);

const pmremGenerator = new THREE.PMREMGenerator(renderer);
const roomEnvironment = new RoomEnvironment(renderer);
const environmentMap = pmremGenerator.fromScene(roomEnvironment).texture;
scene.environment = environmentMap;
scene.environmentIntensity = Number(environmentRange.value);

const hemiLight = new THREE.HemisphereLight(0xf4efe5, 0x24221f, 1.2);
const keyLight = new THREE.DirectionalLight(0xffffff, Number(keyLightRange.value));
keyLight.position.set(4, 6, 5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.near = 0.5;
keyLight.shadow.camera.far = 24;
keyLight.shadow.camera.left = -6;
keyLight.shadow.camera.right = 6;
keyLight.shadow.camera.top = 6;
keyLight.shadow.camera.bottom = -6;

const rimLight = new THREE.DirectionalLight(0x78d6dd, 1.7);
rimLight.position.set(-5, 3, -4);

scene.add(hemiLight, keyLight, rimLight);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(7, 96),
  new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.24 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
ground.position.y = -1.08;
scene.add(ground);

const grid = new THREE.GridHelper(12, 24, 0x5d6566, 0x343839);
grid.position.y = -1.07;
grid.material.opacity = 0.24;
grid.material.transparent = true;
scene.add(grid);

const modelRoot = new THREE.Group();
scene.add(modelRoot);

const loadingManager = new THREE.LoadingManager();
loadingManager.onError = (url) => {
  setLoading(false);
  setStatus(`加载失败：${url}`);
};

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath(`https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/examples/jsm/libs/draco/`);

const gltfLoader = new GLTFLoader(loadingManager);
gltfLoader.setDRACOLoader(dracoLoader);

let activeObject;
let baseRotation = 0;
let ambientAudioUrl;

function setLoading(isLoading, text = "正在加载模型") {
  loadingOverlay.hidden = !isLoading;
  loadingOverlay.classList.toggle("is-visible", isLoading);
  loadingOverlay.setAttribute("aria-hidden", String(!isLoading));
  shell.classList.toggle("is-loading", isLoading);
  loadingText.textContent = text;
}

function setStatus(text) {
  statusText.textContent = text;
}

function setPanelCollapsed(isCollapsed) {
  controlsPanel.classList.toggle("is-collapsed", isCollapsed);
  panelBody.setAttribute("aria-hidden", String(isCollapsed));
  panelToggleButton.textContent = isCollapsed ? "展开" : "收起";
  panelToggleButton.setAttribute("aria-expanded", String(!isCollapsed));
  requestAnimationFrame(handleResize);
  window.setTimeout(handleResize, 240);
}

function formatTime(seconds) {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(seconds, 0) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = String(Math.floor(safeSeconds % 60)).padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function writeAscii(view, offset, text) {
  for (let index = 0; index < text.length; index += 1) {
    view.setUint8(offset + index, text.charCodeAt(index));
  }
}

function createAmbientAudioUrl() {
  const channelCount = 2;
  const bytesPerSample = 2;
  const frameCount = Math.floor(AUDIO_DURATION * AUDIO_SAMPLE_RATE);
  const blockAlign = channelCount * bytesPerSample;
  const byteRate = AUDIO_SAMPLE_RATE * blockAlign;
  const dataSize = frameCount * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, AUDIO_SAMPLE_RATE, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let frame = 0; frame < frameCount; frame += 1) {
    const time = frame / AUDIO_SAMPLE_RATE;
    const slowEnvelope = 0.72 + Math.sin((Math.PI * 2 * time) / 12) * 0.18 + Math.sin((Math.PI * 2 * time) / 18) * 0.1;
    const left =
      (Math.sin(Math.PI * 2 * 110 * time) * 0.28 +
        Math.sin(Math.PI * 2 * 165 * time) * 0.18 +
        Math.sin(Math.PI * 2 * 220 * time) * 0.1) *
      slowEnvelope *
      0.36;
    const right =
      (Math.sin(Math.PI * 2 * 110 * time + 0.18) * 0.26 +
        Math.sin(Math.PI * 2 * 165 * time + 0.4) * 0.16 +
        Math.sin(Math.PI * 2 * 220 * time + 0.25) * 0.12) *
      slowEnvelope *
      0.36;

    view.setInt16(offset, clamp(left, -1, 1) * 32767, true);
    offset += 2;
    view.setInt16(offset, clamp(right, -1, 1) * 32767, true);
    offset += 2;
  }

  return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
}

function getAudioDuration() {
  return Number.isFinite(ambientAudio.duration) && ambientAudio.duration > 0 ? ambientAudio.duration : AUDIO_DURATION;
}

function updateAudioProgress() {
  const duration = getAudioDuration();
  const currentTime = ambientAudio.currentTime || 0;
  audioProgress.value = String(Math.round((currentTime / duration) * Number(audioProgress.max)));
  audioCurrentTime.textContent = formatTime(currentTime);
  audioDuration.textContent = formatTime(duration);
}

function seekAudioFromProgress() {
  const duration = getAudioDuration();
  const nextTime = (Number(audioProgress.value) / Number(audioProgress.max)) * duration;
  ambientAudio.currentTime = clamp(nextTime, 0, duration);
  updateAudioProgress();
}

function setupAudioPlayer() {
  try {
    ambientAudioUrl = createAmbientAudioUrl();
    ambientAudio.src = ambientAudioUrl;
    ambientAudio.volume = Number(audioVolume.value);
    ambientAudio.load();
    audioDuration.textContent = formatTime(AUDIO_DURATION);
    audioStatus.textContent = "内置音频已加载";
  } catch (error) {
    console.error(error);
    audioStatus.textContent = "音频初始化失败";
    playAudioButton.disabled = true;
  }
}

function clearModel() {
  while (modelRoot.children.length) {
    const child = modelRoot.children.pop();
    disposeObject(child);
  }
  activeObject = undefined;
}

function disposeObject(object) {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if (!material) continue;
      for (const value of Object.values(material)) {
        if (value?.isTexture) value.dispose();
      }
      material.dispose();
    }
  });
}

function configureObject(object) {
  object.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if (!material) continue;
      material.wireframe = wireframeToggle.checked;
      if (material.map) material.map.colorSpace = THREE.SRGBColorSpace;
      material.needsUpdate = true;
    }
  });
}

function normalizeObject(object) {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;

  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxAxis = Math.max(size.x, size.y, size.z);
  const scale = maxAxis > 0 ? 3.4 / maxAxis : 1;

  object.scale.multiplyScalar(scale);
  object.position.sub(center.multiplyScalar(scale));
}

function fitCameraToModel() {
  const box = new THREE.Box3().setFromObject(modelRoot);
  if (box.isEmpty()) return;

  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxSize = Math.max(size.x, size.y, size.z);
  const fitHeightDistance = maxSize / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  const distance = fitHeightDistance * 1.28;

  controls.target.copy(center);
  camera.near = Math.max(distance / 100, 0.01);
  camera.far = distance * 100;
  camera.position.set(center.x + distance * 0.78, center.y + distance * 0.44, center.z + distance);
  camera.updateProjectionMatrix();
  controls.update();
}

function useModel(object, label) {
  clearModel();
  configureObject(object);
  normalizeObject(object);
  modelRoot.add(object);
  activeObject = object;
  baseRotation = 0;
  modelRoot.rotation.set(0, 0, 0);
  modelName.textContent = label;
  setStatus("模型已载入");
  fitCameraToModel();
  setLoading(false);
}

function createProceduralModel() {
  const group = new THREE.Group();

  const metal = new THREE.MeshStandardMaterial({
    color: 0xd6d9d2,
    metalness: 0.72,
    roughness: 0.28
  });
  const darkMetal = new THREE.MeshStandardMaterial({
    color: 0x25292b,
    metalness: 0.64,
    roughness: 0.38
  });
  const tealGlass = new THREE.MeshPhysicalMaterial({
    color: 0x1fa1a8,
    metalness: 0.1,
    roughness: 0.08,
    transmission: 0.18,
    thickness: 0.35,
    clearcoat: 0.8
  });
  const amber = new THREE.MeshStandardMaterial({
    color: 0xd89a36,
    metalness: 0.32,
    roughness: 0.24,
    emissive: 0x2b1700,
    emissiveIntensity: 0.25
  });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.1, 0.34, 96), darkMetal);
  base.position.y = -0.86;
  group.add(base);

  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 1.1, 0.52, 64), metal);
  pedestal.position.y = -0.46;
  group.add(pedestal);

  const core = new THREE.Mesh(new THREE.TorusKnotGeometry(0.82, 0.18, 180, 22), tealGlass);
  core.position.y = 0.48;
  core.rotation.set(0.2, 0.4, -0.1);
  group.add(core);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.035, 14, 140), amber);
  ring.rotation.x = Math.PI / 2.35;
  ring.position.y = 0.44;
  group.add(ring);

  const capsule = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 1.42, 12, 24), metal);
  capsule.rotation.z = Math.PI / 2;
  capsule.position.y = 0.46;
  group.add(capsule);

  for (let index = 0; index < 6; index += 1) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.72, 0.28), darkMetal);
    const angle = (index / 6) * Math.PI * 2;
    fin.position.set(Math.cos(angle) * 1.35, -0.18, Math.sin(angle) * 1.35);
    fin.rotation.y = -angle;
    group.add(fin);
  }

  group.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
  });

  return group;
}

function loadProceduralModel() {
  useModel(createProceduralModel(), "备用程序模型");
}

function getModelLabel(url) {
  return url === PROJECT_MODEL_URL ? PROJECT_MODEL_LABEL : url.split("/").pop() || "项目模型";
}

function loadModelFromUrl(url, label = getModelLabel(url)) {
  setLoading(true, "正在加载项目模型");
  gltfLoader.load(
    url,
    (gltf) => {
      setLoading(false);
      useModel(gltf.scene, label);
    },
    (event) => {
      if (!event.total) return;
      const percent = Math.round((event.loaded / event.total) * 100);
      loadingText.textContent = `正在加载模型 ${percent}%`;
    },
    () => {
      setLoading(false);
      loadProceduralModel();
      setStatus("内置模型加载失败，已切换备用模型");
    }
  );
}

function loadBuiltInModel() {
  if (window.location.protocol === "file:") {
    loadProceduralModel();
    setStatus("请通过本地服务器打开以加载内置模型");
    return;
  }

  loadModelFromUrl(PROJECT_MODEL_URL, PROJECT_MODEL_LABEL);
}

function tryLoadProjectModel() {
  const modelUrl = new URLSearchParams(window.location.search).get("model") || PROJECT_MODEL_URL;
  if (window.location.protocol === "file:") {
    loadProceduralModel();
    setStatus("请通过本地服务器打开以加载内置模型");
    return;
  }

  fetch(modelUrl, { method: "HEAD", cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error("Project model not found");
      loadModelFromUrl(modelUrl);
    })
    .catch(() => {
      loadProceduralModel();
      setStatus("就绪");
    });
}

function loadFile(file) {
  if (!file) return;
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!["glb", "gltf"].includes(extension)) {
    setStatus("请选择 GLB 或 GLTF 文件");
    return;
  }

  setLoading(true, "正在读取模型");
  const reader = new FileReader();
  reader.onload = () => {
    const result = reader.result;
    gltfLoader.parse(
      result,
      "",
      (gltf) => {
        setLoading(false);
        useModel(gltf.scene, file.name);
      },
      (error) => {
        console.error(error);
        setLoading(false);
        setStatus("模型解析失败");
      }
    );
  };
  reader.onerror = () => {
    setLoading(false);
    setStatus("文件读取失败");
  };

  if (extension === "gltf") reader.readAsText(file);
  else reader.readAsArrayBuffer(file);
}

function applyWireframe(enabled) {
  if (!activeObject) return;
  activeObject.traverse((child) => {
    if (!child.isMesh) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if (!material) continue;
      material.wireframe = enabled;
      material.needsUpdate = true;
    }
  });
}

function handleResize() {
  const width = stage.clientWidth;
  const height = stage.clientHeight;
  camera.aspect = width / Math.max(height, 1);
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

openModelButton.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => loadFile(fileInput.files?.[0]));
resetViewButton.addEventListener("click", fitCameraToModel);
defaultModelButton.addEventListener("click", loadBuiltInModel);
panelToggleButton.addEventListener("click", () => {
  setPanelCollapsed(!controlsPanel.classList.contains("is-collapsed"));
});

playAudioButton.addEventListener("click", () => {
  if (ambientAudio.paused) {
    ambientAudio
      .play()
      .then(() => {
        audioStatus.textContent = "正在播放";
      })
      .catch((error) => {
        console.error(error);
        audioStatus.textContent = "请再次点击播放";
      });
    return;
  }

  ambientAudio.pause();
});

ambientAudio.addEventListener("loadedmetadata", updateAudioProgress);
ambientAudio.addEventListener("timeupdate", updateAudioProgress);
ambientAudio.addEventListener("play", () => {
  playAudioButton.textContent = "暂停";
  audioStatus.textContent = "正在播放";
});
ambientAudio.addEventListener("pause", () => {
  playAudioButton.textContent = "播放";
  audioStatus.textContent = "已暂停";
});
ambientAudio.addEventListener("error", () => {
  audioStatus.textContent = "音频加载失败";
});
audioProgress.addEventListener("input", () => {
  const duration = getAudioDuration();
  const previewTime = (Number(audioProgress.value) / Number(audioProgress.max)) * duration;
  audioCurrentTime.textContent = formatTime(previewTime);
});
audioProgress.addEventListener("change", seekAudioFromProgress);
audioVolume.addEventListener("input", () => {
  ambientAudio.volume = Number(audioVolume.value);
});

wireframeToggle.addEventListener("change", () => applyWireframe(wireframeToggle.checked));
exposureRange.addEventListener("input", () => {
  renderer.toneMappingExposure = Number(exposureRange.value);
});
keyLightRange.addEventListener("input", () => {
  keyLight.intensity = Number(keyLightRange.value);
});
environmentRange.addEventListener("input", () => {
  scene.environmentIntensity = Number(environmentRange.value);
});

window.addEventListener("resize", handleResize);
if ("ResizeObserver" in window) {
  const resizeObserver = new ResizeObserver(handleResize);
  resizeObserver.observe(stage);
}
window.addEventListener("dragover", (event) => {
  event.preventDefault();
  shell.classList.add("dragging");
});
window.addEventListener("dragleave", (event) => {
  if (event.clientX <= 0 || event.clientY <= 0 || event.clientX >= window.innerWidth || event.clientY >= window.innerHeight) {
    shell.classList.remove("dragging");
  }
});
window.addEventListener("drop", (event) => {
  event.preventDefault();
  shell.classList.remove("dragging");
  loadFile(event.dataTransfer?.files?.[0]);
});
window.addEventListener("beforeunload", () => {
  if (ambientAudioUrl) URL.revokeObjectURL(ambientAudioUrl);
});

const clock = new THREE.Clock();

function animate() {
  const delta = clock.getDelta();
  if (activeObject && autoRotateToggle.checked) {
    baseRotation += delta * Number(speedRange.value);
    modelRoot.rotation.y = baseRotation;
  }
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

handleResize();
setupAudioPlayer();
tryLoadProjectModel();
animate();
