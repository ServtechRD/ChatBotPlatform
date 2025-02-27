import React, { useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import EmbeddableChatInterface from '../components/EmbeddableChatInterface';

/**
 * 嵌入頁面組件
 * 用於提供嵌入到第三方網站的界面
 */
const EmbedPage = () => {
  const { assistantId } = useParams(); // 如果使用路由參數
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const idFromQuery = queryParams.get('id'); // 從查詢參數獲取ID

  const [error, setError] = useState(null);

  // 優先使用URL參數，其次使用路由參數
  const id = idFromQuery || assistantId;

  if (!id) {
    return (
      <Box
        sx={{
          height: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column',
          p: 3,
          textAlign: 'center',
        }}
      >
        <Typography variant="h6" color="error" gutterBottom>
          錯誤：未提供助手ID
        </Typography>
        <Typography>請確保URL包含正確的ID參數，例如：/embed?id=123</Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        height: '100vh',
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        p: 0,
        m: 0,
        overflow: 'hidden',
        bgcolor: 'transparent',
      }}
    >
      <EmbeddableChatInterface
        assistantId={id}
        containerStyle={{
          width: '100%',
          height: '100%',
          margin: 0,
          maxWidth: 'none',
          maxHeight: 'none',
        }}
        onError={err => setError(err.message)}
      />

      {error && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            bgcolor: 'rgba(0,0,0,0.7)',
            color: 'white',
            zIndex: 9999,
          }}
        >
          <Typography>載入錯誤: {error}</Typography>
        </Box>
      )}
    </Box>
  );
};

export default EmbedPage;
