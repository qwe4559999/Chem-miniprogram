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
    this.initOnnxSession();
    this.initOcrSession();

    // Initialize the canvas for preprocessing output
    const modelInputWidth = 224; // MobileNetV2 typical input width
    const modelInputHeight = 224; // MobileNetV2 typical input height
    try {
      this.preprocessedCanvas = wx.createOffscreenCanvas({ type: '2d', width: modelInputWidth, height: modelInputHeight });
      this.preprocessCtx = this.preprocessedCanvas.getContext('2d');
      console.log(`Preprocessed canvas (${modelInputWidth}x${modelInputHeight}) initialized.`);
    } catch (e) {
      console.error('Failed to create offscreen canvas for preprocessing:', e);
      wx.showToast({ title: '图像处理模块初始化失败', icon: 'none' });
    }
    
    this.sourceCanvas = null;
    this.sourceCtx = null;
    this.lastFrameWidth = 0;
    this.lastFrameHeight = 0;
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
    // OffscreenCanvas doesn't have a destroy method, JS garbage collection will handle them
    this.preprocessedCanvas = null;
    this.preprocessCtx = null;
    this.sourceCanvas = null;
    this.sourceCtx = null;
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

  async processFrame(frame) {
    if (this.data.onnxSession) {
      try {
        const detectionResult = await this.runYoloDetection(frame);
        
        if (detectionResult) {
          console.log('YOLO 检测结果 (来自 await):', detectionResult);
          this.setData({ processing: false });
        } else {
          if (this.data.processing) {
            this.setData({ processing: false });
          }
        }
      } catch (error) {
        console.error('processFrame 中调用 runYoloDetection 失败:', error);
        this.setData({ processing: false });
      }
    } else {
      this.setData({ processing: false });
    }
  },

  async runYoloDetection(frame) {
    if (!this.data.onnxSession) {
      console.error('ONNX会话未初始化 (runYoloDetection)');
      this.setData({ processing: false });
      return null;
    }

    // === IMPORTANT: Configure for the currently loaded model (MobileNetV2 in this case) ===
    const inputName = 'data'; // <--- 修改这里，与模型匹配
    const outputName = 'mobilenetv20_output_flatten0_reshape0'; // 这个看起来是正确的
    const targetWidth = 224;  // MobileNetV2 typical input width
    const targetHeight = 224; // MobileNetV2 typical input height
    // === End of model-specific configuration ===

    let preprocessedData; // This will hold the final Float32Array for the model

    try {
      if (!this.preprocessCtx) {
        console.error('Preprocess context not initialized!');
        this.setData({ processing: false });
        return null;
      }
      const { data: frameDataBuffer, width: frameWidth, height: frameHeight } = frame;
      if (!this.sourceCanvas || this.lastFrameWidth !== frameWidth || this.lastFrameHeight !== frameHeight) {
        this.sourceCanvas = wx.createOffscreenCanvas({ type: '2d', width: frameWidth, height: frameHeight });
        this.sourceCtx = this.sourceCanvas.getContext('2d');
        this.lastFrameWidth = frameWidth;
        this.lastFrameHeight = frameHeight;
      }
      if (!this.sourceCtx) {
          console.error('Source context not available after attempting initialization!');
          this.setData({ processing: false });
          return null;
      }
      const originalImageData = this.sourceCtx.createImageData(frameWidth, frameHeight);
      const rgbaData = new Uint8ClampedArray(frameDataBuffer);
      originalImageData.data.set(rgbaData);
      this.sourceCtx.putImageData(originalImageData, 0, 0);
      this.preprocessCtx.clearRect(0, 0, targetWidth, targetHeight);
      this.preprocessCtx.drawImage(this.sourceCanvas, 0, 0, frameWidth, frameHeight, 0, 0, targetWidth, targetHeight);
      const scaledImageData = this.preprocessCtx.getImageData(0, 0, targetWidth, targetHeight);
      const pixels = scaledImageData.data;
      const float32Input = new Float32Array(targetWidth * targetHeight * 3);
      const R_PLANE_OFFSET = 0;
      const G_PLANE_OFFSET = targetWidth * targetHeight;
      const B_PLANE_OFFSET = targetWidth * targetHeight * 2;
      for (let y = 0; y < targetHeight; y++) {
        for (let x = 0; x < targetWidth; x++) {
          const HWC_index = (y * targetWidth + x) * 4;
          const r = pixels[HWC_index + 0] / 255.0;
          const g = pixels[HWC_index + 1] / 255.0;
          const b = pixels[HWC_index + 2] / 255.0;
          const CHW_pixel_index = y * targetWidth + x;
          float32Input[R_PLANE_OFFSET + CHW_pixel_index] = r;
          float32Input[G_PLANE_OFFSET + CHW_pixel_index] = g;
          float32Input[B_PLANE_OFFSET + CHW_pixel_index] = b;
        }
      }
      preprocessedData = float32Input; // <--- 确保 float32Input 是预处理的结果
      console.log('使用真实的相机帧预处理数据进行推理。');

    } catch (e) {
      console.error('Error during image preprocessing:', e);
      this.setData({processing: false});
      return null;
    }
    
    // === 测试用的虚拟数据部分，现在可以注释掉或移除了 ===
    // const dummyDataArray = new Float32Array(1 * 3 * targetHeight * targetWidth).fill(0.0);
    // const currentTestData = dummyDataArray; 
    // console.log('警告: 当前运行使用的是虚拟全零输入数据进行测试!');
    // === 测试结束 ===
    
    try {
      // Log the parameters being passed to session.run()
      const modelInputObject = {
        data: preprocessedData.buffer, // <--- 使用真实预处理数据的 buffer
        shape: [1, 3, targetHeight, targetWidth], 
        type: 'float32'
      };
      
      const onnxRunParams = {
        [inputName]: modelInputObject 
      };

      console.log('Type of currentTestData:', Object.prototype.toString.call(preprocessedData));
      console.log('Is currentTestData a Float32Array?', preprocessedData instanceof Float32Array);
      if (preprocessedData instanceof Float32Array) {
        console.log('currentTestData.length:', preprocessedData.length);
        console.log('currentTestData.byteLength:', preprocessedData.byteLength);
        console.log('currentTestData.buffer type:', Object.prototype.toString.call(preprocessedData.buffer)); 
        console.log('currentTestData.buffer byteLength:', preprocessedData.buffer.byteLength); 
      }

      console.log('ONNX run() parameters (Tutorial Style, .buffer):', JSON.stringify(onnxRunParams, (key, value) => {
        if (key === 'data' && value instanceof ArrayBuffer) { // 主要显示 ArrayBuffer
          return `ArrayBuffer(byteLength:${value.byteLength})`;
        }
        return value;
      }, 2));

      const outputMap = await this.data.onnxSession.run(onnxRunParams);

      const rawOutput = outputMap[outputName];
      
      if (rawOutput && rawOutput.data instanceof ArrayBuffer) {
        console.log('原始输出 rawOutput:', rawOutput);
        const outputArray = new Float32Array(rawOutput.data);
        console.log('解析后的输出数组 (前10个值):', outputArray.slice(0, 10)); // 打印前10个看看

        // 找到得分最高的索引 (ArgMax)
        let maxScore = -Infinity;
        let maxIndex = -1;
        for (let i = 0; i < outputArray.length; i++) {
          if (outputArray[i] > maxScore) {
            maxScore = outputArray[i];
            maxIndex = i;
          }
        }
        console.log(`最高得分: ${maxScore}, 对应索引: ${maxIndex}`);
        
        // TODO: 根据 maxIndex 查询类别名称 (需要一个类别映射表)
        // 例如: const className = imagenetClasses[maxIndex];
        // this.setData({ ocrResultText: `类别: ${className} (得分: ${maxScore.toFixed(2)})` });

        this.setData({ processing: false }); // 推理完成，重置状态
        return { index: maxIndex, score: maxScore }; // 返回一个简化结果，或整个 outputArray

      } else {
        console.error(`未能从模型输出 outputMap 中获取名为 '${outputName}' 的有效张量。OutputMap:`, outputMap);
        this.setData({ processing: false });
        return null;
      }
    } catch (error) {
      console.error('ONNX 推理失败 (session.run await):', error);
      this.setData({ processing: false });
      return null;
    }
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
    const modelFileNameInApp = 'mobilenetv2-7.onnx'; // <--- 修改这里
    const modelUrl = 'https://raw.githubusercontent.com/qwe4559999/Chem-miniprogram/main/mobilenetv2-7.onnx'; // <--- 修改这里
    const modelPathUser = `${wx.env.USER_DATA_PATH}/${modelFileNameInApp}`;

    console.log(`模型下载链接: ${modelUrl}`);
    console.log(`模型将保存到用户路径: ${modelPathUser}`);

    const fs = wx.getFileSystemManager();

    const loadAndCreateSession = (filePath) => {
      console.log(`尝试从路径创建 ONNX session: ${filePath}`);
      try {
        const session = wx.createInferenceSession({ model: filePath });
        
        session.onLoad(() => {
          console.log('ONNX session 加载成功 (onLoad event)!');
          this.setData({ onnxSession: session });
          wx.showToast({ title: '模型加载完毕', icon: 'success', duration: 1500 });
        });

        session.onError((err) => {
          console.error('ONNX session 加载失败 (onError event):', err);
          let errMsg = '模型内部加载失败';
          if (err && err.errMsg) {
            if (err.errMsg.includes('Illegal onnx model name')) {
              errMsg = '模型文件名错误';
            } else if (err.errMsg.includes('model file not found')) {
              errMsg = '模型文件未找到';
            }
          }
          wx.showToast({ title: errMsg, icon: 'error', duration: 3500 });
          this.setData({ onnxSession: null });
        });

      } catch (err) {
        console.error('wx.createInferenceSession 调用时直接抛出错误:', err);
        wx.showToast({ title: '模型创建调用失败', icon: 'error', duration: 3000 });
        this.setData({ onnxSession: null });
      }
    };

    wx.downloadFile({
      url: modelUrl,
      success: (res) => {
        if (res.statusCode === 200) {
          console.log('模型下载成功，临时路径:', res.tempFilePath);
          
          fs.saveFile({
            tempFilePath: res.tempFilePath,
            filePath: modelPathUser,
            success: (saveRes) => {
              console.log(`模型已成功保存到用户目录: ${modelPathUser}`);
              loadAndCreateSession(modelPathUser);
            },
            fail: (saveErr) => {
              console.error('保存下载的模型文件失败:', saveErr);
              wx.showToast({ title: '模型保存失败', icon: 'error', duration: 3000 });
              this.setData({ onnxSession: null });
            }
          });
        } else {
          console.error('下载模型文件失败，状态码:', res.statusCode);
          wx.showToast({ title: `下载失败(${res.statusCode})`, icon: 'error', duration: 3000 });
        }
      },
      fail: (err) => {
        console.error('wx.downloadFile 调用失败:', err);
        wx.showToast({ title: '模型下载请求失败', icon: 'error', duration: 3000 });
        this.setData({ onnxSession: null });
      }
    });
  },

  initOcrSession() {
    console.log('初始化 OCR 会话');
    if (!wx.createVKSession) {
      console.error('当前基础库版本不支持 VKSession');
      return;
    }
    try {
      const ocrSession = wx.createVKSession({ 
          track: { OCR: { mode: 2 } },
      });

      ocrSession.start(err => {
        if (err) { 
            console.error('OCR session 启动失败', err);
            return; 
        }
        console.log('OCR session 启动成功');
        this.setData({ ocrSession: ocrSession });
        
        ocrSession.on('updateAnchors', ({ anchors }) => {
          if (anchors && anchors.length > 0) {
            const texts = anchors.map(anchor => anchor.text).join('\\n');
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
    }
  },

  cameraError(e) {
    console.error('相机错误:', e.detail);
    wx.showToast({ title: '相机出错', icon: 'error' });
    this.setData({ cameraReady: false });
  }
})