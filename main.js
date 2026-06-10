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
const dropdownBtn = document.querySelector("#dropdownBtn");
const dropdownArrow = document.querySelector("#dropdownArrow");
const dropdownList = document.querySelector("#dropdownList");
const dropdownCurrentLabel = document.querySelector("#dropdownCurrentLabel");
const dropdownItems = document.querySelectorAll(".dropdown-item");
const autoRotateToggle = document.querySelector("#autoRotateToggle");
const renderingModeBtn = document.querySelector("#renderingModeBtn");
const renderingModeArrow = document.querySelector("#renderingModeArrow");
const renderingModeList = document.querySelector("#renderingModeList");
const renderingModeCurrentLabel = document.querySelector("#renderingModeCurrentLabel");
const renderingModeItems = document.querySelectorAll(".rendering-mode-item");
const speedRange = document.querySelector("#speedRange");
const exposureRange = document.querySelector("#exposureRange");
const keyLightRange = document.querySelector("#keyLightRange");
const environmentRange = document.querySelector("#environmentRange");
const modelName = document.querySelector("#modelName");
const statusText = document.querySelector("#statusText");
const loadingOverlay = document.querySelector("#loadingOverlay");
const loadingText = document.querySelector("#loadingText");
const controlsPanel = document.querySelector("#controlsPanel");
const openSettingsButton = document.querySelector("#openSettingsButton");
const closePanelButton = document.querySelector("#closePanelButton");
const ambientAudio = document.querySelector("#ambientAudio");
const playAudioButton = document.querySelector("#playAudioButton");
const audioStatus = document.querySelector("#audioStatus");
const audioProgress = document.querySelector("#audioProgress");
const audioCurrentTime = document.querySelector("#audioCurrentTime");
const audioDuration = document.querySelector("#audioDuration");
const audioVolume = document.querySelector("#audioVolume");

const themeToggleButton = document.querySelector("#themeToggleButton");

const AUDIO_DURATION = 36;
const AUDIO_SAMPLE_RATE = 22050;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090d10);
scene.fog = new THREE.Fog(0x090d10, 12, 32);

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
let mixer;
let rotateTargets = [];

function setLoading(isLoading, text = "正在加载模型") {
  loadingOverlay.hidden = !isLoading;
  loadingOverlay.classList.toggle("is-visible", isLoading);
  loadingOverlay.setAttribute("aria-hidden", String(!isLoading));
  shell.classList.toggle("is-loading", isLoading);
  loadingText.textContent = text;
  const progressBar = document.querySelector("#loadingProgressBar");
  if (progressBar) {
    progressBar.style.width = "0%";
  }
}

function setStatus(text) {
  statusText.textContent = text;
}

function toggleSettingsPanel(open) {
  const isCurrentlyOpen = controlsPanel.classList.contains("is-open");
  const nextOpen = open !== undefined ? open : !isCurrentlyOpen;
  
  if (nextOpen) {
    controlsPanel.classList.add("is-open");
    openSettingsButton.classList.add("is-active");
  } else {
    controlsPanel.classList.remove("is-open");
    openSettingsButton.classList.remove("is-active");
  }
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

function updateSliderProgressBackground(slider) {
  const value = Number(slider.value);
  const max = Number(slider.max) || 100;
  const percentage = (value / max) * 100;
  slider.style.background = `linear-gradient(to right, var(--accent-color) ${percentage}%, var(--btn-bg) ${percentage}%)`;
}

function updateAudioProgress() {
  const duration = getAudioDuration();
  const currentTime = ambientAudio.currentTime || 0;
  audioProgress.value = String(Math.round((currentTime / duration) * Number(audioProgress.max)));
  audioCurrentTime.textContent = formatTime(currentTime);
  audioDuration.textContent = formatTime(duration);
  updateSliderProgressBackground(audioProgress);
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
    updateSliderProgressBackground(audioVolume);
    updateSliderProgressBackground(audioProgress);
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
      
      // Apply the active rendering mode to the newly configured model
      if (currentRenderingMode === "wireframe") {
        material.wireframe = true;
        material.transparent = false;
        material.opacity = 1.0;
      } else if (currentRenderingMode === "xray") {
        material.wireframe = false;
        material.transparent = true;
        material.opacity = 0.35;
      } else {
        material.wireframe = false;
        material.transparent = false;
        material.opacity = 1.0;
      }
      
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

function useModel(object, label, animations = []) {
  clearModel();
  configureObject(object);
  normalizeObject(object);
  modelRoot.add(object);
  activeObject = object;
  baseRotation = 0;
  modelRoot.rotation.set(0, 0, 0);
  modelName.textContent = label;
  setStatus("模型已载入");

  // Scan and cache rotating components (e.g. fan blades) once when loading
  rotateTargets = [];
  let primaryRotor = null;

  object.traverse((child) => {
    const name = child.name.toLowerCase();
    // Search for a parent group/hub containing all blades or rotating elements
    if (name.includes("rotor") || name.includes("hub") || name.includes("blades") || name.includes("propeller") || name.includes("spinner") || name.includes("spinning_part")) {
      if (!primaryRotor || child.children.length > primaryRotor.children.length) {
        primaryRotor = child;
      }
    }
  });

  if (primaryRotor) {
    rotateTargets.push(primaryRotor);
    console.log(`Identified primary rotor assembly: "${primaryRotor.name}"`);
  } else {
    // Fallback: collect all individual blade elements
    object.traverse((child) => {
      const name = child.name.toLowerCase();
      if (name.includes("blade") || name.includes("wing") || name.includes("leaf") || name.includes("fan_blade")) {
        // Prevent adding parent nodes if children are already collected to avoid double-rotation
        let isParentOfAnotherTarget = false;
        child.traverse((subChild) => {
          if (subChild !== child && (subChild.name.toLowerCase().includes("blade") || subChild.name.toLowerCase().includes("wing"))) {
            isParentOfAnotherTarget = true;
          }
        });
        if (!isParentOfAnotherTarget) {
          rotateTargets.push(child);
        }
      }
    });
    if (rotateTargets.length > 0) {
      console.log(`Identified ${rotateTargets.length} individual blade elements:`, rotateTargets.map(t => t.name));
    }
  }

  // Initialize AnimationMixer if animations exist
  if (animations && animations.length > 0) {
    mixer = new THREE.AnimationMixer(object);
    animations.forEach((clip) => {
      mixer.clipAction(clip).play();
    });
    console.log(`Loaded ${animations.length} animations for ${label}`);
  } else {
    mixer = null;
    console.log(`No built-in animations for ${label}`);
  }

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

function createProceduralFanModel() {
  const fanGroup = new THREE.Group();

  // Materials with vintage styling
  const antiqueBrass = new THREE.MeshStandardMaterial({
    color: 0x8c7853, // warm gold / brass
    metalness: 0.82,
    roughness: 0.32,
    name: "Brass"
  });
  
  const darkWood = new THREE.MeshStandardMaterial({
    color: 0x422a1d, // dark mahogany wood
    metalness: 0.05,
    roughness: 0.45,
    name: "Wood"
  });

  const glassShade = new THREE.MeshPhysicalMaterial({
    color: 0xfffaed,
    metalness: 0.1,
    roughness: 0.15,
    transmission: 0.65,
    thickness: 0.25,
    emissive: 0xffe6bd,
    emissiveIntensity: 0.3,
    name: "Glass"
  });

  const lightBulb = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffecc2,
    emissiveIntensity: 1.6,
    name: "Bulb"
  });

  // 1. Canopy (ceiling mount)
  const canopy = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 0.2, 32), antiqueBrass);
  canopy.position.y = 1.65;
  fanGroup.add(canopy);

  // 2. Downrod
  const downrod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 16), antiqueBrass);
  downrod.position.y = 1.0;
  fanGroup.add(downrod);

  // 3. Motor Housing (stationary upper part)
  const motorHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.32, 48), antiqueBrass);
  motorHousing.position.y = 0.42;
  fanGroup.add(motorHousing);

  // 4. Rotor Assembly (this part rotates procedurally)
  const rotor = new THREE.Group();
  rotor.name = "fan_rotor"; // named so scan finds it
  rotor.position.y = 0.22;
  
  // Rotor center hub
  const rotorBody = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.76, 0.16, 48), antiqueBrass);
  rotorBody.castShadow = true;
  rotorBody.receiveShadow = true;
  rotor.add(rotorBody);

  // Add 5 fan blades
  const bladeCount = 5;
  for (let index = 0; index < bladeCount; index += 1) {
    const angle = (index / bladeCount) * Math.PI * 2;
    
    // Blade holder metal bracket
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.04, 0.08), antiqueBrass);
    bracket.position.set(Math.cos(angle) * 0.45, -0.02, Math.sin(angle) * 0.45);
    bracket.rotation.y = -angle;
    bracket.castShadow = true;
    rotor.add(bracket);

    // Wood blade body
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.015, 0.18), darkWood);
    // Position wood body further out radially
    blade.position.set(Math.cos(angle) * 1.05, -0.02, Math.sin(angle) * 1.05);
    // Tilted blade angle (pitch)
    blade.rotation.y = -angle;
    blade.rotation.x = 0.12; // tilt for aerodynamic blade pitch
    blade.name = `blade_${index}`;
    blade.castShadow = true;
    rotor.add(blade);
  }
  fanGroup.add(rotor);

  // 5. Vintage light fixture shade and bulb (bottom stationary part)
  const lightFixture = new THREE.Group();
  lightFixture.position.y = 0.05;

  const glassCup = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.18, 0.26, 32, 1, true), glassShade);
  glassCup.position.y = -0.12;
  lightFixture.add(glassCup);

  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 16), lightBulb);
  bulb.position.y = -0.1;
  lightFixture.add(bulb);
  
  fanGroup.add(lightFixture);

  // Shadow config
  fanGroup.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  return fanGroup;
}

function loadProceduralModel() {
  useModel(createProceduralModel(), "备用程序模型");
}

function loadProceduralFanModel() {
  useModel(createProceduralFanModel(), "复古吊扇 (程序生成备用)");
}

function getModelLabel(url) {
  return url === PROJECT_MODEL_URL ? PROJECT_MODEL_LABEL : url.split("/").pop() || "项目模型";
}

function loadModelFromUrl(url, label = getModelLabel(url), fallbackType = "onion") {
  setLoading(true, "正在加载项目模型");
  gltfLoader.load(
    url,
    (gltf) => {
      setLoading(false);
      useModel(gltf.scene, label, gltf.animations);
    },
    (event) => {
      if (!event.total) return;
      const percent = Math.round((event.loaded / event.total) * 100);
      loadingText.textContent = `正在加载模型 ${percent}%`;
      const progressBar = document.querySelector("#loadingProgressBar");
      if (progressBar) {
        progressBar.style.width = `${percent}%`;
      }
    },
    () => {
      setLoading(false);
      if (fallbackType === "fan") {
        loadProceduralFanModel();
        setStatus("未找到内置吊扇模型，已启用高精度程序模型");
      } else {
        loadProceduralModel();
        setStatus("内置模型加载失败，已切换备用模型");
      }
    }
  );
}

function loadBuiltInModel(key = "onion") {
  if (window.location.protocol === "file:") {
    if (key === "fan") {
      loadProceduralFanModel();
      setStatus("请通过本地服务器打开以加载内置模型（已加载备用吊扇）");
    } else {
      loadProceduralModel();
      setStatus("请通过本地服务器打开以加载内置模型");
    }
    return;
  }

  if (key === "onion") {
    loadModelFromUrl(PROJECT_MODEL_URL, PROJECT_MODEL_LABEL, "onion");
  } else if (key === "fan") {
    loadModelFromUrl("assets/models/ceiling_fan_1k.gltf/ceiling_fan_1k.gltf", "复古吊扇 1K 材质模型", "fan");
  }
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

  setLoading(true, "正在读取文件 0%");
  const reader = new FileReader();

  reader.onprogress = (event) => {
    if (event.lengthComputable) {
      const percent = Math.round((event.loaded / event.total) * 100);
      loadingText.textContent = `正在读取文件 ${percent}%`;
      const progressBar = document.querySelector("#loadingProgressBar");
      if (progressBar) {
        progressBar.style.width = `${percent}%`;
      }
    }
  };

  reader.onload = () => {
    const progressBar = document.querySelector("#loadingProgressBar");
    if (progressBar) {
      progressBar.style.width = "100%";
    }
    loadingText.textContent = "正在解析并构建三维场景...";
    const result = reader.result;

    // Allow UI thread to update status before freezing for sync parsing
    setTimeout(() => {
      gltfLoader.parse(
        result,
        "",
        (gltf) => {
          setLoading(false);
          useModel(gltf.scene, file.name, gltf.animations);
        },
        (error) => {
          console.error(error);
          setLoading(false);
          setStatus("模型解析失败");
        }
      );
    }, 50);
  };
  reader.onerror = () => {
    setLoading(false);
    setStatus("文件读取失败");
  };

  if (extension === "gltf") reader.readAsText(file);
  else reader.readAsArrayBuffer(file);
}

let currentRenderingMode = "shaded"; // 'shaded', 'wireframe', 'xray', 'normals', 'depth'

function applyRenderingMode(mode) {
  currentRenderingMode = mode;
  
  if (mode === "normals") {
    scene.overrideMaterial = new THREE.MeshNormalMaterial();
  } else if (mode === "depth") {
    scene.overrideMaterial = new THREE.MeshDepthMaterial();
  } else {
    scene.overrideMaterial = null;
  }
  
  if (!activeObject) return;
  
  activeObject.traverse((child) => {
    if (!child.isMesh) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if (!material) continue;
      
      if (mode === "wireframe") {
        material.wireframe = true;
        material.transparent = false;
        material.opacity = 1.0;
      } else if (mode === "xray") {
        material.wireframe = false;
        material.transparent = true;
        material.opacity = 0.35;
      } else {
        material.wireframe = false;
        material.transparent = false;
        material.opacity = 1.0;
      }
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
function toggleDropdown(open) {
  const isCurrentlyOpen = !dropdownList.classList.contains("pointer-events-none");
  const nextOpen = open !== undefined ? open : !isCurrentlyOpen;
  
  if (nextOpen) {
    dropdownList.classList.remove("scale-95", "opacity-0", "pointer-events-none");
    dropdownList.classList.add("scale-100", "opacity-100");
    dropdownArrow.classList.add("rotate-180");
    dropdownBtn.setAttribute("aria-expanded", "true");
  } else {
    dropdownList.classList.remove("scale-100", "opacity-100");
    dropdownList.classList.add("scale-95", "opacity-0", "pointer-events-none");
    dropdownArrow.classList.remove("rotate-180");
    dropdownBtn.setAttribute("aria-expanded", "false");
  }
}

function toggleRenderingModeDropdown(open) {
  const isCurrentlyOpen = !renderingModeList.classList.contains("pointer-events-none");
  const nextOpen = open !== undefined ? open : !isCurrentlyOpen;
  
  if (nextOpen) {
    renderingModeList.classList.remove("scale-95", "opacity-0", "pointer-events-none");
    renderingModeList.classList.add("scale-100", "opacity-100");
    renderingModeArrow.classList.add("rotate-180");
    renderingModeBtn.setAttribute("aria-expanded", "true");
  } else {
    renderingModeList.classList.remove("scale-100", "opacity-100");
    renderingModeList.classList.add("scale-95", "opacity-0", "pointer-events-none");
    renderingModeArrow.classList.remove("rotate-180");
    renderingModeBtn.setAttribute("aria-expanded", "false");
  }
}

dropdownBtn.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleDropdown();
  toggleRenderingModeDropdown(false);
});

renderingModeBtn.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleRenderingModeDropdown();
  toggleDropdown(false);
});

document.addEventListener("click", () => {
  toggleDropdown(false);
  toggleRenderingModeDropdown(false);
});

dropdownItems.forEach((item) => {
  item.addEventListener("click", () => {
    const value = item.getAttribute("data-value");
    
    // Extract label text from inner span to avoid including any text content from dot indicator
    const labelSpan = item.querySelector("span:first-child");
    dropdownCurrentLabel.textContent = labelSpan ? labelSpan.textContent.trim() : item.textContent.trim();
    
    dropdownItems.forEach((btn) => {
      btn.classList.remove("is-active");
    });
    item.classList.add("is-active");
    
    loadBuiltInModel(value);
    toggleDropdown(false);
  });
});
openSettingsButton.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleSettingsPanel();
});

closePanelButton.addEventListener("click", () => {
  toggleSettingsPanel(false);
});

controlsPanel.addEventListener("click", (event) => {
  event.stopPropagation();
});

// Closing settings drawer when clicking viewport stage
stage.addEventListener("click", () => {
  toggleSettingsPanel(false);
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

const muteVolumeButton = document.querySelector("#muteVolumeButton");
const volumeIcon = document.querySelector("#volumeIcon");
const soundWave = document.querySelector(".sound-wave");
let preMuteVolume = 0.55;

function updateVolumeIcon(volume) {
  if (volume === 0) {
    volumeIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25M12 18.75V5.25L7.75 9H4.5v6h3.25L12 18.75z"/>`;
  } else if (volume < 0.5) {
    volumeIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" d="M15.536 8.464a5 5 0 010 7.072M12 18.75V5.25L7.75 9H4.5v6h3.25L12 18.75z"/>`;
  } else {
    volumeIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M12 18.75V5.25L7.75 9H4.5v6h3.25L12 18.75z"/>`;
  }
}

if (muteVolumeButton) {
  muteVolumeButton.addEventListener("click", () => {
    if (ambientAudio.volume > 0) {
      preMuteVolume = ambientAudio.volume;
      ambientAudio.volume = 0;
      audioVolume.value = 0;
    } else {
      ambientAudio.volume = preMuteVolume;
      audioVolume.value = preMuteVolume;
    }
    updateSliderProgressBackground(audioVolume);
    updateVolumeIcon(ambientAudio.volume);
  });
}

ambientAudio.addEventListener("loadedmetadata", updateAudioProgress);
ambientAudio.addEventListener("timeupdate", updateAudioProgress);
ambientAudio.addEventListener("play", () => {
  playAudioButton.innerHTML = `<svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
  audioStatus.textContent = "正在播放";
  soundWave?.classList.add("is-playing");
});
ambientAudio.addEventListener("pause", () => {
  playAudioButton.innerHTML = `<svg class="w-4 h-4 fill-current ml-0.5" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
  audioStatus.textContent = "已暂停";
  soundWave?.classList.remove("is-playing");
});
ambientAudio.addEventListener("error", () => {
  audioStatus.textContent = "音频加载失败";
});
audioProgress.addEventListener("input", () => {
  const duration = getAudioDuration();
  const previewTime = (Number(audioProgress.value) / Number(audioProgress.max)) * duration;
  audioCurrentTime.textContent = formatTime(previewTime);
  updateSliderProgressBackground(audioProgress);
});
audioProgress.addEventListener("change", seekAudioFromProgress);
audioVolume.addEventListener("input", () => {
  const vol = Number(audioVolume.value);
  ambientAudio.volume = vol;
  updateSliderProgressBackground(audioVolume);
  updateVolumeIcon(vol);
});

renderingModeItems.forEach((item) => {
  item.addEventListener("click", (event) => {
    event.stopPropagation();
    const value = item.getAttribute("data-value");
    
    // Extract label text from inner span
    const labelSpan = item.querySelector("span:first-child");
    renderingModeCurrentLabel.textContent = labelSpan ? labelSpan.textContent.trim() : item.textContent.trim();
    
    renderingModeItems.forEach((btn) => {
      btn.classList.remove("is-active");
    });
    item.classList.add("is-active");
    
    applyRenderingMode(value);
    toggleRenderingModeDropdown(false);
    
    // Auto-close settings panel after a short delay to let the user inspect the full-screen 3D model
    setTimeout(() => {
      toggleSettingsPanel(false);
    }, 250);
  });
});
exposureRange.addEventListener("input", () => {
  renderer.toneMappingExposure = Number(exposureRange.value);
});
let isLightTheme = true;

function applyTheme(light) {
  isLightTheme = light;
  document.body.classList.toggle("theme-light", light);
  localStorage.setItem("theme-light", String(light));
  
  if (light) {
    scene.background.setHex(0xeef2f6);
    scene.fog.color.setHex(0xeef2f6);
    scene.fog.near = 16;
    scene.fog.far = 40;
    
    keyLight.color.setHex(0xfffaee);
    keyLight.intensity = Number(keyLightRange.value) * 1.1;
    hemiLight.color.setHex(0xffffff);
    hemiLight.groundColor.setHex(0xd2d7df);
    hemiLight.intensity = 1.4;
    
    rimLight.color.setHex(0xffecc2);
    rimLight.intensity = 0.8;
    
    grid.material.opacity = 0.16;
    grid.material.color.setHex(0x94a3b8);
    ground.material.opacity = 0.12;
  } else {
    scene.background.setHex(0x090d10);
    scene.fog.color.setHex(0x090d10);
    scene.fog.near = 12;
    scene.fog.far = 32;
    
    keyLight.color.setHex(0xffffff);
    keyLight.intensity = Number(keyLightRange.value);
    hemiLight.color.setHex(0xf4efe5);
    hemiLight.groundColor.setHex(0x24221f);
    hemiLight.intensity = 1.2;
    
    rimLight.color.setHex(0x78d6dd);
    rimLight.intensity = 1.7;
    
    grid.material.opacity = 0.24;
    grid.material.color.setHex(0x5d6566);
    ground.material.opacity = 0.24;
  }
}

themeToggleButton.addEventListener("click", () => {
  applyTheme(!isLightTheme);
});

keyLightRange.addEventListener("input", () => {
  keyLight.intensity = Number(keyLightRange.value) * (isLightTheme ? 1.1 : 1.0);
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
  if (mixer) {
    mixer.update(delta);
  }
  
  if (activeObject && autoRotateToggle.checked) {
    if (!mixer && rotateTargets.length > 0) {
      // Procedurally spin cached blades or rotor on their local Y axis
      const rotationStep = delta * Number(speedRange.value) * 6;
      rotateTargets.forEach((target) => {
        target.rotation.y += rotationStep;
      });
    } else if (!mixer) {
      // Fallback: rotate the entire model if no specific blades were detected
      baseRotation += delta * Number(speedRange.value);
      modelRoot.rotation.y = baseRotation;
    }
  }
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

handleResize();
setupAudioPlayer();
const savedTheme = localStorage.getItem("theme-light");
const initialTheme = savedTheme === null ? true : savedTheme === "true";
applyTheme(initialTheme);
tryLoadProjectModel();
animate();
