Page({
  data: {
    ocrResultText: '等待识别...', // 用于在 WXML 中显示结果
    cameraReady: false,      // 相机是否准备好
    processing: false,       // 是否正在处理帧
    onnxSession: null,       // ONNX 推理会话
    ocrSession: null,        // VisionKit OCR 会话
    lastFrameTime: 0,      // 上一帧处理时间，用于控制帧率
    frameInterval: 500,    // 处理帧的时间间隔 (ms)，例如 500ms 处理一次
  },

  onReady() {
    console.log('Page Ready');
    this.initCamera();
    // 后续在这里初始化 ONNX 和 OCR 会话
    this.initOnnxSession();
    this.initOcrSession();
  },

  onUnload() {
    console.log('Page Unload');
    this.stopCameraFrameListener();
    if (this.data.onnxSession) {
      this.data.onnxSession.destroy();
    }
    if (this.data.ocrSession) {
      this.data.ocrSession.destroy();
    }
  },

  initCamera() {
    const cameraContext = wx.createCameraContext(this);
    if (!cameraContext) {
      console.error('无法创建相机上下文');
      wx.showToast({ title: '相机初始化失败', icon: 'error' });
      return;
    }
    this.cameraContext = cameraContext;
    this.setData({ cameraReady: true });
    console.log('相机初始化成功');
    this.startCameraFrameListener(); // 相机初始化成功后开始监听
  },

  startCameraFrameListener() {
    if (!this.data.cameraReady) return;
    console.log('开始监听相机帧数据');
    this.listener = this.cameraContext.onCameraFrame(frame => {
      const now = Date.now();
      // 控制处理频率，避免处理过快导致卡顿
      if (now - this.data.lastFrameTime < this.data.frameInterval) {
        return;
      }
      if (!this.data.processing) {
        this.setData({ processing: true, lastFrameTime: now });
        console.log('获取到相机帧', frame.width, frame.height);
        // --- 核心处理逻辑开始 ---
        this.processFrame(frame);
        // --- 核心处理逻辑结束 ---
      }
    });
    this.listener.start(); // 启动监听器
    console.log('相机帧监听器已启动');
  },

  stopCameraFrameListener() {
    if (this.listener) {
      console.log('停止监听相机帧数据');
      this.listener.stop();
    }
  },

  processFrame(frame) {
    console.log('开始处理帧...');
    // 1. TODO: 将帧数据传递给 ONNX 模型进行瓶子检测
    // const detectedBottles = this.runYoloDetection(frame);

    // 2. TODO: 如果检测到瓶子，裁剪图像区域
    // if (detectedBottles && detectedBottles.length > 0) {
    //   const croppedImage = this.cropImage(frame, detectedBottles[0].bbox); // 示例：只处理第一个检测到的瓶子
      
    //   // 3. TODO: 将裁剪后的图像传递给 VisionKit OCR 进行识别
    //   this.runOcr(croppedImage);
    // } else {
       // 如果没有检测到瓶子，也需要重置 processing 状态
       this.setData({ processing: false }); 
    // }
    
    // --- 模拟处理结束 ---
    // 暂时先直接设置为 false，后续由 OCR 回调或无检测结果时设置
     setTimeout(() => { this.setData({ processing: false }); }, 100); // 模拟耗时
    console.log('帧处理结束（模拟）');
  },

  runYoloDetection(frame) {
    // TODO: 实现 ONNX 推理逻辑
    console.log('运行YOLO检测（待实现）');
    // 需要将 frame.data (ArrayBuffer) 转换为 ONNX 模型所需的输入格式
    // 调用 this.data.onnxSession.run(...)
    // 解析输出，返回边界框信息
    return []; // 暂存返回空数组
  },

  cropImage(frame, bbox) {
    // TODO: 实现图像裁剪逻辑
    console.log('裁剪图像（待实现）');
    // 根据 bbox 坐标从 frame.data 中提取子图像数据
    // 返回裁剪后的图像数据 { data: ArrayBuffer, width: number, height: number }
    return null; // 暂存返回 null
  },

  runOcr(image) {
    // TODO: 实现 VisionKit OCR 调用
    console.log('运行OCR');
    if (this.data.ocrSession && image) {
      try {
        this.data.ocrSession.runOCR({
          frameBuffer: image.data, // 确保 image 包含 { data: ArrayBuffer, width: number, height: number }
          width: image.width,
          height: image.height,
        });
        console.log('runOCR 调用成功');
        // 注意：结果在 on('updateAnchors') 回调中处理，这里不需要立刻重置 processing
      } catch (err) {
        console.error('调用 runOCR 时出错:', err);
        this.setData({ ocrResultText: 'OCR调用出错', processing: false }); // 调用出错，重置状态
      }
    } else {
      if (!image) console.warn('OCR 输入图像为空');
      if (!this.data.ocrSession) console.warn('OCR 会话未初始化');
      this.setData({ processing: false }); // 如果 OCR 会话无效或图像无效，也需要重置状态
    }
  },

  // --- 初始化 ONNX 和 OCR 的函数占位符 ---
  initOnnxSession() {
    console.log('初始化 ONNX 会话');
    const modelFileName = 'best.onnx'; // 使用你的模型文件名
    const modelPathUser = `${wx.env.USER_DATA_PATH}/${modelFileName}`; // 模型在用户目录的目标路径
    const modelPathProject = 'model/best.onnx'; // 模型在项目包内的正确相对路径 (miniprogram/model/best.onnx)
                                                
    console.log(`用户数据目录目标路径: ${modelPathUser}`);
    console.log(`项目包内源路径: ${modelPathProject}`);

    const fs = wx.getFileSystemManager();

    // 封装加载模型的逻辑
    const loadModel = () => {
        console.log('尝试加载模型...');
        try {
            const session = wx.createInferenceSession({ model: modelPathUser });
            console.log('ONNX session 创建成功');
            this.setData({ onnxSession: session });
        } catch (err) {
            console.error('创建 ONNX session 失败:', err);
            wx.showToast({ title: '模型加载失败', icon: 'error' });
        }
    };

    // 1. 检查模型是否已存在于用户数据目录
    fs.access({
        path: modelPathUser,
        success: (res) => {
            console.log('模型文件已存在于用户目录，直接加载。');
            loadModel(); // 文件已存在，直接加载
        },
        fail: (err) => {
            console.log('模型文件不在用户目录，尝试从项目包复制...');
            // 2. 如果不存在，尝试从项目包内复制
            fs.copyFile({
                srcPath: modelPathProject, // 源文件路径（包内）
                destPath: modelPathUser,   // 目标文件路径（用户目录）
                success: (res) => {
                    console.log('模型文件复制成功，开始加载。');
                    loadModel(); // 复制成功后加载
                },
                fail: (copyErr) => {
                    console.error(`模型文件复制失败: src=${modelPathProject}, dest=${modelPathUser}`, copyErr);
                    wx.showToast({ title: '模型复制失败', icon: 'error', duration: 3000 });
                    // 检查 modelPathProject 是否正确指向了包内文件
                    // 也可能是包体积过大、权限等问题
                }
            });
        }
    });
  },

  initOcrSession() {
    console.log('初始化 OCR 会话');
    if (!wx.createVKSession) {
      console.error('当前基础库版本不支持 VKSession');
      // wx.showToast({ title: 'OCR功能不可用', icon: 'error', duration: 3000 }); // 模拟器中不弹窗
      return;
    }
    try {
      const ocrSession = wx.createVKSession({ 
          track: { OCR: { mode: 2 } }, // 使用静态图片检测模式
      });

      ocrSession.start(err => {
        if (err) { 
            console.error('OCR session 启动失败', err);
            // wx.showToast({ title: 'OCR启动失败', icon: 'error' }); // 模拟器中不弹窗
            return; 
        }
        console.log('OCR session 启动成功');
        this.setData({ ocrSession: ocrSession });
        
        ocrSession.on('updateAnchors', ({ anchors }) => {
          if (anchors && anchors.length > 0) {
            const texts = anchors.map(anchor => anchor.text).join('\n');
            console.log('OCR 识别结果:', texts);
            this.setData({ ocrResultText: texts, processing: false });
          } else {
            console.log('OCR 未识别到文字');
            this.setData({ ocrResultText: '未识别到文字', processing: false });
          }
        });

        ocrSession.on('error', err => {
            console.error('OCR session 发生错误', err);
            this.setData({ ocrResultText: 'OCR出错', processing: false });
        });

      });
    } catch (err) {
      console.error('创建 OCR session 失败', err);
      // wx.showToast({ title: 'OCR初始化失败', icon: 'error' }); // 模拟器中不弹窗
    }
  },

  cameraError(e) {
    console.error('相机错误:', e.detail);
    wx.showToast({ title: '相机出错', icon: 'error' });
    this.setData({ cameraReady: false });
  }
}) 