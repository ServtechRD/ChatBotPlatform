import React, { useState, useEffect, useRef } from 'react';
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

import { formatImageUrl } from '../utils/urlUtils';

import ApiService from './ApiService';

const EditAIAssistantDialog = ({ open, onClose, aiAssistant }) => {
  const [description, setDescription] = useState('');
  const [language, setLanguage] = useState('繁體中文');
  const [allowLiveChat, setAllowLiveChat] = useState(false);
  const [aiAssistantUrl, setAiAssistantUrl] = useState('');
  const [name, setName] = useState('');

  // 圖片相關狀態
  const [image, setImage] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [crop, setCrop] = useState({
    unit: '%',
    width: 30,
    aspect: 1,
  });
  const [completedCrop, setCompletedCrop] = useState(null);
  const [croppedImageUrl, setCroppedImageUrl] = useState('');

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
      setAiAssistantUrl(aiAssistant.url || '');
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
      }

      if (aiAssistant.image_crop) {
        setCroppedImageUrl(formatImageUrl(aiAssistant.image_crop));
      }

      if (aiAssistant.video1) {
        setVideoUrl1(formatImageUrl(aiAssistant.video1));
      }

      if (aiAssistant.video2) {
        setVideoUrl1(formatImageUrl(aiAssistant.video2));
      }
    }
  }, [aiAssistant]);

  // 處理圖片上傳
  const handleImageUpload = e => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImageUrl(reader.result);
        setImage(reader.result);
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
  const generateCroppedImage = async () => {
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
  };

  useEffect(() => {
    if (completedCrop) {
      generateCroppedImage();
    }
  }, [completedCrop]);

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

      // 如果有裁剪後的圖片，轉換為文件並添加到表單
      if (croppedImageUrl) {
        //const response = await fetch(croppedImageUrl);
        //const blob = await response.blob();
        const corp_imge_file = base64ToFile(croppedImageUrl, 'crop_image.jpg');
        formData.append('crop_image', corp_imge_file);
      }

      if (image) {
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
      if (aiAssistant?.id) {
        await ApiService.updateAssistant(aiAssistant.id, formData);
        alert('更新成功！');
      } else {
        await ApiService.createAssistant(formData);
        alert('建立成功！');
      }
      onClose();
    } catch (error) {
      alert(`${aiAssistant?.id ? '更新' : '建立'}失敗: ${error}`);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{aiAssistant?.id ? '編輯AI助理' : '新AI助理'}</DialogTitle>
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
                  選擇區域
                </Typography>
                <Paper variant="outlined" sx={{ p: 1 }}>
                  <ReactCrop
                    crop={crop}
                    onChange={c => setCrop(c)}
                    onComplete={c => setCompletedCrop(c)}
                    aspect={1}
                  >
                    <img
                      ref={imageRef}
                      src={imageUrl}
                      style={{ maxWidth: '100%' }}
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
                    width: 100,
                    height: 100,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <img
                    src={croppedImageUrl}
                    alt="Cropped"
                    style={{ maxWidth: '100%', maxHeight: '100%' }}
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

        <FormControl fullWidth variant="outlined" margin="normal">
          <InputLabel>預設回覆語系</InputLabel>
          <Select
            value={language}
            onChange={e => setLanguage(e.target.value)}
            label="預設回覆語系"
          >
            <MenuItem value="繁體中文">繁體中文</MenuItem>
            <MenuItem value="英文">英文</MenuItem>
          </Select>
        </FormControl>

        <Typography variant="caption" color="textSecondary">
          AI助理將優先使用所設語系進行回覆。若無法使用預設語系，中文用戶可使用中文來詢問繁體中文。
        </Typography>

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
          {aiAssistant?.id ? '更新' : '儲存'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditAIAssistantDialog;
