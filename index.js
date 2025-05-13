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
    // this.initOnnxSession(); 
    // this.initOcrSession();
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
    console.log('运行OCR（待实现）');
    // if (this.data.ocrSession) {
    //   this.data.ocrSession.runOCR({
    //     frameBuffer: image.data,
    //     width: image.width,
    //     height: image.height,
    //   });
    // } else {
        this.setData({ processing: false }); // 如果 OCR 会话无效，也需要重置状态
    // }
  },

  // --- 初始化 ONNX 和 OCR 的函数占位符 ---
  initOnnxSession() {
    console.log('初始化 ONNX 会话（待实现）');
    // const fs = wx.getFileSystemManager();
    // try {
    //   const modelPath = `${wx.env.USER_DATA_PATH}/your_model.onnx`; // 模型需要先下载或放入用户目录
    //   // 检查模型文件是否存在...
    //   const session = wx.createInferenceSession({ model: modelPath });
    //   this.setData({ onnxSession: session });
    //   console.log('ONNX session 创建成功');
    // } catch (err) {
    //   console.error('创建 ONNX session 失败', err);
    //   wx.showToast({ title: '模型加载失败', icon: 'error' });
    // }
  },

  initOcrSession() {
    console.log('初始化 OCR 会话（待实现）');
    // try {
    //   const ocrSession = wx.createVKSession({ 
    //       track: { OCR: { mode: 2 } }, 
    //       version: 'v2' // 建议使用 v2 接口
    //   });
    //   ocrSession.start(err => {
    //     if (err) return console.error('OCR session 启动失败', err);
    //     console.log('OCR session 启动成功');
    //     this.setData({ ocrSession: ocrSession });
        
    //     // 监听 OCR 结果
    //     ocrSession.on('updateAnchors', anchors => {
    //       const texts = anchors.map(anchor => anchor.text).join(' \n'); // 将所有识别结果合并
    //       console.log('OCR 识别结果:', texts);
    //       this.setData({ ocrResultText: texts || '未识别到文字', processing: false });
    //     });
    //     ocrSession.on('error', err => {
    //         console.error('OCR session 发生错误', err);
    //         this.setData({ ocrResultText: 'OCR出错', processing: false });
    //     })

    //   });
    // } catch (err) {
    //   console.error('创建 OCR session 失败', err);
    //   wx.showToast({ title: 'OCR初始化失败', icon: 'error' });
    // }
  },

  cameraError(e) {
    console.error('相机错误:', e.detail);
    wx.showToast({ title: '相机出错', icon: 'error' });
    this.setData({ cameraReady: false });
  }
}) 