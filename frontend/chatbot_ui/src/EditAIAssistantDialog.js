import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Typography,
  IconButton,
  Box,
  Paper,
} from '@mui/material';
import {
  Link as LinkIcon,
  ContentCopy as ContentCopyIcon,
  AddPhotoAlternate as AddPhotoIcon,
  VideoCall as VideoIcon,
} from '@mui/icons-material';

import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

import { formatImageUrl } from './utils/urlUtils';

import ApiService from './ApiService';

const UPLOAD_IMAGE_WIDTH = 398;
const UPLOAD_IMAGE_HEIGHT = 598;
const CROP_SIZE = 200;

const EditAIAssistantDialog = ({ open, onClose, aiAssistant, onSaved }) => {
  const [description, setDescription] = useState('');
  const [language, setLanguage] = useState('Traditional Chinese');
  const [allowLiveChat, setAllowLiveChat] = useState(false);
  const [aiAssistantUrl, setAiAssistantUrl] = useState('');
  const [name, setName] = useState('');

  const [welcomeText, setWelcomeText] = useState('');
  const [unableToRespondText, setUnableToRespondText] = useState('');

  // 圖片相關狀態
  const [image, setImage] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [crop, setCrop] = useState({
    unit: 'px',
    width: CROP_SIZE,
    height: CROP_SIZE,
    x: (UPLOAD_IMAGE_WIDTH - CROP_SIZE) / 2,
    y: (UPLOAD_IMAGE_HEIGHT - CROP_SIZE) / 2,
  });
  const [completedCrop, setCompletedCrop] = useState(null);
  const [croppedImageUrl, setCroppedImageUrl] = useState('');
  // 新增一個 state 來追蹤是否有新上傳的圖片
  const [hasNewImage, setHasNewImage] = useState(false);

  // 影片相關狀態
  const [video1, setVideo1] = useState(null);
  const [video2, setVideo2] = useState(null);
  const [videoUrl1, setVideoUrl1] = useState('');
  const [videoPreview1, setVideoPreview1] = useState(false);
  const [videoUrl2, setVideoUrl2] = useState('');
  const [videoPreview2, setVideoPreview2] = useState(false);

  const imageRef = useRef(null);
  const videoRef1 = useRef(null);
  const videoRef2 = useRef(null);
  const fileInputRef = useRef(null);
  const videoInputRef1 = useRef(null);
  const videoInputRef2 = useRef(null);

  useEffect(() => {
    if (aiAssistant) {
      setName(aiAssistant.name || '');
      setDescription(aiAssistant.description || '');
      setAiAssistantUrl(aiAssistant.link || '');

      setWelcomeText(aiAssistant.message_welcome || 'welcome');
      setUnableToRespondText(aiAssistant.message_noidea || 'No response');

      // 如果 aiAssistant 有 language 屬性，也可以設置
      if (aiAssistant.language) {
        setLanguage(aiAssistant.language);
      }
      // 如果有 allowLiveChat 屬性，也可以設置
      if (aiAssistant.allowLiveChat !== undefined) {
        setAllowLiveChat(aiAssistant.allowLiveChat);
      }

      if (aiAssistant.image_assistant) {
        setImageUrl(formatImageUrl(aiAssistant.image_assistant));
        setHasNewImage(false); // 重置新圖片標記
      }

      if (aiAssistant.image_crop) {
        setCroppedImageUrl(formatImageUrl(aiAssistant.image_crop));
      }

      if (aiAssistant.video_1) {
        setVideoUrl1(formatImageUrl(aiAssistant.video_1));
      }

      if (aiAssistant.video_2) {
        setVideoUrl1(formatImageUrl(aiAssistant.video_2));
      }
    }
  }, [aiAssistant]);

  // 處理圖片上傳
  const handleImageUpload = e => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      /*reader.addEventListener('load', () => {
        setImageUrl(reader.result);
        setImage(reader.result);
      });
      reader.readAsDataURL(file);*/
      reader.addEventListener('load', () => {
        // 創建新的 Image 對象來獲取圖片尺寸
        const img = new Image();
        img.onload = () => {
          // 計算縮放比例
          const scale = Math.min(
            UPLOAD_IMAGE_WIDTH / img.width,
            UPLOAD_IMAGE_HEIGHT / img.height
          );

          // 設置初始裁剪區域在中心
          const newCrop = {
            unit: 'px',
            width: CROP_SIZE,
            height: CROP_SIZE,
            x: (UPLOAD_IMAGE_WIDTH - CROP_SIZE) / 2,
            y: (UPLOAD_IMAGE_HEIGHT - CROP_SIZE) / 2,
          };

          setCrop(newCrop);
          setImageUrl(reader.result);
          setImage(reader.result);
          setHasNewImage(true); // 重置新圖片標記
        };
        img.src = reader.result;
      });
      reader.readAsDataURL(file);
    }
  };

  // 處理影片上傳
  const handleVideoUpload1 = e => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setVideoUrl1(reader.result);
        setVideo1(file);
      });
      reader.readAsDataURL(file);
    }
  };

  const handleVideoUpload2 = e => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setVideoUrl2(reader.result);
        setVideo2(file);
      });
      reader.readAsDataURL(file);
    }
  };

  // 生成裁剪後的圖片
  /*const generateCroppedImage = async () => {
    if (!imageRef.current || !completedCrop) return;

    const canvas = document.createElement('canvas');
    const scaleX = imageRef.current.naturalWidth / imageRef.current.width;
    const scaleY = imageRef.current.naturalHeight / imageRef.current.height;
    canvas.width = completedCrop.width;
    canvas.height = completedCrop.height;
    const ctx = canvas.getContext('2d');

    ctx.drawImage(
      imageRef.current,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      completedCrop.width,
      completedCrop.height
    );

    // 將裁剪後的圖片轉換為URL
    const base64Image = canvas.toDataURL('image/jpeg');
    setCroppedImageUrl(base64Image);
  };*/

  const generateCroppedImage = useCallback(() => {
    const image = imageRef.current;
    if (!image || !completedCrop?.width || !completedCrop?.height) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // 原圖對應的實際像素比例（確保不會變形）
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    // 設定輸出大小 (正方形 200x200)
    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = CROP_SIZE * pixelRatio;
    canvas.height = CROP_SIZE * pixelRatio;

    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.imageSmoothingQuality = 'high';

    // 補上白底（非必要）
    ctx.fillStyle = '#FFF';
    ctx.fillRect(0, 0, CROP_SIZE, CROP_SIZE);

    // 使用 completedCrop 的 px 值（即使 unit 為 %，react-image-crop 會轉成 px）
    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      CROP_SIZE,
      CROP_SIZE
    );

    const base64 = canvas.toDataURL('image/jpeg', 0.95);
    setCroppedImageUrl(base64);
  }, [completedCrop]);

  useEffect(() => {
    if (completedCrop) {
      generateCroppedImage();
    }
  }, [completedCrop, generateCroppedImage]);

  function base64ToFile(base64, filename) {
    const byteString = atob(base64.split(',')[1]); // 解码 Base64
    const mimeString = base64.split(',')[0].match(/:(.*?);/)[1]; // 获取 MIME 类型
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new File([ab], filename, { type: mimeString });
  }

  const handleSave = async () => {
    // 处理保存逻辑
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('description', description);
      formData.append('language', language);
      formData.append('note', '');

      formData.append('welcome', welcomeText);
      formData.append('noidea', unableToRespondText);

      // 如果有裁剪後的圖片，轉換為文件並添加到表單
      if (hasNewImage && croppedImageUrl) {
        //const response = await fetch(croppedImageUrl);
        //const blob = await response.blob();
        const corp_imge_file = base64ToFile(croppedImageUrl, 'crop_image.jpg');
        formData.append('crop_image', corp_imge_file);
      }

      if (hasNewImage && image) {
        formData.append(
          'assistant_image',
          base64ToFile(imageUrl, 'assistant_image.jpg')
        );
      }

      // 如果有影片，添加到表單
      if (video1) {
        formData.append('video_1', video1);
      }
      if (video2) {
        formData.append('video_2', video2);
      }
      if (aiAssistant?.assistant_id) {
        await ApiService.updateAssistant(aiAssistant.assistant_id, formData);
        alert('更新成功！');
      } else {
        await ApiService.createAssistant(formData);
        alert('建立成功！');
      }

      // 呼叫 onSaved callback，並傳入保存的數據
      if (onSaved) {
        onSaved(aiAssistant);
      }

      onClose();
    } catch (error) {
      alert(`${aiAssistant?.assistant_id ? '更新' : '建立'}失敗: ${error}`);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {aiAssistant?.assistant_id ? '編輯AI助理' : '新AI助理'}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="textSecondary" gutterBottom>
          AI助理助理主要使用情境以及使用者知悉與其互動。對於表現演算結果的使用情境，請使用範本填入背景知識。請根據您的需求修改範本中的問題。
        </Typography>
        <Box display="flex" alignItems="center" marginTop={2}>
          <Typography variant="body2">AI 助理名稱:</Typography>
          <TextField
            value={name}
            onChange={e => setName(e.target.value)}
            variant="outlined"
            size="small"
            fullWidth
            sx={{ ml: 1, mr: 1 }}
          />
        </Box>

        <TextField
          label="描述"
          multiline
          rows={4}
          fullWidth
          variant="outlined"
          value={description}
          onChange={e => setDescription(e.target.value)}
          margin="normal"
        />

        {/* 圖片上傳和裁剪區域 */}
        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            助理圖示
          </Typography>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            style={{ display: 'none' }}
            ref={fileInputRef}
          />
          <Button
            variant="outlined"
            startIcon={<AddPhotoIcon />}
            onClick={() => fileInputRef.current.click()}
            sx={{ mb: 2 }}
          >
            上傳圖片
          </Button>

          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            {imageUrl && (
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  選擇區域 (可調整大小,保持正方形)
                </Typography>
                <Paper
                  variant="outlined"
                  sx={{
                    width: UPLOAD_IMAGE_WIDTH,
                    height: UPLOAD_IMAGE_HEIGHT,
                    overflow: 'hidden',
                  }}
                >
                  <ReactCrop
                    crop={crop}
                    onChange={(_, percentCrop) => setCrop(percentCrop)}
                    onComplete={c => setCompletedCrop(c)}
                    aspect={1}
                  >
                    <img
                      ref={imageRef}
                      src={imageUrl}
                      crossOrigin="anonymous"
                      alt="Upload"
                      style={{
                        maxWidth: UPLOAD_IMAGE_WIDTH,
                        maxHeight: UPLOAD_IMAGE_HEIGHT,
                        objectFit: 'contain',
                      }}
                      onLoad={e => {
                        e.currentTarget.style.aspectRatio = `${e.currentTarget.naturalWidth}/${e.currentTarget.naturalHeight}`;
                      }}
                    />
                  </ReactCrop>
                </Paper>
              </Box>
            )}

            {croppedImageUrl && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  預覽圖示
                </Typography>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1,
                    width: CROP_SIZE,
                    height: CROP_SIZE,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  <img
                    src={croppedImageUrl}
                    alt="Cropped"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                </Paper>
              </Box>
            )}
          </Box>
        </Box>

        {/* 影片上傳區域 */}
        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            背景影片#1
          </Typography>
          <input
            type="file"
            accept="video/*"
            onChange={handleVideoUpload1}
            style={{ display: 'none' }}
            ref={videoInputRef1}
          />
          <Button
            variant="outlined"
            startIcon={<VideoIcon />}
            onClick={() => videoInputRef1.current.click()}
            sx={{ mb: 2 }}
          >
            上傳影片1
          </Button>

          {videoUrl1 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                影片預覽1
              </Typography>
              <Paper variant="outlined" sx={{ p: 1 }}>
                <video
                  ref={videoRef1}
                  src={videoUrl1}
                  style={{ maxWidth: '100%', maxHeight: 200 }}
                  controls
                />
              </Paper>
            </Box>
          )}
        </Box>

        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            背景影片#2
          </Typography>
          <input
            type="file"
            accept="video/*"
            onChange={handleVideoUpload2}
            style={{ display: 'none' }}
            ref={videoInputRef2}
          />
          <Button
            variant="outlined"
            startIcon={<VideoIcon />}
            onClick={() => videoInputRef2.current.click()}
            sx={{ mb: 2 }}
          >
            上傳影片2
          </Button>

          {videoUrl1 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                影片預覽2
              </Typography>
              <Paper variant="outlined" sx={{ p: 1 }}>
                <video
                  ref={videoRef2}
                  src={videoUrl2}
                  style={{ maxWidth: '100%', maxHeight: 200 }}
                  controls
                />
              </Paper>
            </Box>
          )}
        </Box>
        <Box sx={{ mb: 3 }}>
          <Typography variant="caption" color="textSecondary">
            AI助理將優先使用所設語系進行回覆。若無法使用預設語系，中文用戶可使用中文來詢問繁體中文。
          </Typography>
          <FormControl fullWidth variant="outlined" margin="normal">
            <InputLabel>預設回覆語系</InputLabel>
            <Select
              value={language}
              onChange={e => setLanguage(e.target.value)}
              label="預設回覆語系"
            >
              <MenuItem value="Traditional Chinese">繁體中文</MenuItem>
              <MenuItem value="english">英文</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {/* 歡迎文字 */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="caption" color="textSecondary">
            此訊息將在使用者開始對話時顯示
          </Typography>
          <TextField
            label=""
            fullWidth
            multiline
            rows={2}
            variant="outlined"
            value={welcomeText}
            onChange={e => setWelcomeText(e.target.value)}
            placeholder="請輸入當使用者進入對話時的歡迎訊息"
            sx={{ mb: 1 }}
          />
        </Box>

        {/* 無法回應文字 */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="caption" color="textSecondary">
            當AI無法理解或無法提供適當回應時，將顯示此訊息
          </Typography>
          <TextField
            label=""
            fullWidth
            multiline
            rows={2}
            variant="outlined"
            value={unableToRespondText}
            onChange={e => setUnableToRespondText(e.target.value)}
            placeholder="請輸入當AI無法理解或回應時的訊息"
            sx={{ mb: 1 }}
          />
        </Box>

        <Box display="flex" alignItems="center" marginTop={2}>
          <Typography variant="body2">AI助理網址: {aiAssistantUrl}</Typography>

          <IconButton size="small">
            <LinkIcon />
          </IconButton>
          <IconButton size="small">
            <ContentCopyIcon />
          </IconButton>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button
          onClick={handleSave}
          disabled={!name.trim() || !description.trim()}
          variant="contained"
          color="primary"
        >
          {aiAssistant?.assistant_id ? '更新' : '儲存'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditAIAssistantDialog;
