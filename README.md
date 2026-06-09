# 三维模型展厅

一个独立的静态 Three.js 模型查看器，不依赖 Node、npm 或 Vite。

## 打开

建议用静态服务器打开，这样内置的 glTF 模型可以正常加载同目录的 `.bin` 和贴图文件：

```bash
python3 -m http.server 5501
```

然后访问 `http://127.0.0.1:5501/`。

页面会从 CDN 加载 Tailwind CSS、Three.js、OrbitControls、GLTFLoader、DRACOLoader 和 RoomEnvironment。

## 内置模型

默认加载：

`assets/models/yellow_onion_2k.gltf/yellow_onion_2k.gltf`

## 加载模型

- 点击 `导入模型` 选择 `.glb` 或 `.gltf` 文件。
- 将 `.glb` 或 `.gltf` 文件拖入查看器。
- 点击 `内置模型` 可恢复项目自带模型。
- GUI 面板支持展开/收起；桌面端位于画布右侧，移动端位于画布下方，并内置一个本地生成的环境音频播放器。

直接打开 `index.html` 时，浏览器可能会限制内置 glTF 的相对资源加载；此时页面会切换到备用程序模型。

## Files

- `index.html`: 静态页面、Tailwind CDN 中文界面和 CDN import map
- `styles.css`: WebGL 画布、加载层、拖拽层和原生控件补充样式
- `main.js`: Three.js 场景、灯光、控制器、模型加载、拖拽导入
- `assets/models/`: 项目内置模型资源
