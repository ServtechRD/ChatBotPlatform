import React from 'react';
import {
  Button,
  Card,
  CardContent,
  Typography,
  Grid,
  Box,
  Divider,
} from '@mui/material';
import {
  Link as LinkIcon,
  Map as MapIcon,
  TableChart as FileSpreadsheetIcon,
  Description as FileTextIcon,
  Code as FileJsonIcon,
  Videocam as VideoIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const IconWrapper = ({ children }) => (
  <Box
    sx={{
      width: 40,
      height: 40,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '50%',
      bgcolor: 'grey.100',
    }}
  >
    {children}
  </Box>
);

const KnowledgeBaseItem = ({ icon, title, description }) => (
  <Card sx={{ height: '100%' }}>
    <CardContent>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <IconWrapper>{icon}</IconWrapper>
        <Typography variant="h6" sx={{ ml: 2 }}>
          {title}
        </Typography>
      </Box>
      <Box
        sx={{
          color: 'text.secondary',
        }}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {description ?? ''}
        </ReactMarkdown>
      </Box>
    </CardContent>
  </Card>
);

const KnowledgeBaseUI = () => {
  const sections = [
    {
      title: '從網路匯入',
      items: [
        {
          icon: <LinkIcon />,
          title: '匯入網址',
          description: '從網頁上的文字和連結回答',
        },
        {
          icon: <MapIcon />,
          title: '匯入站點地圖',
          description: '站點地圖 URL 通常是 .xml 文件',
        },
      ],
    },
    {
      title: '上傳檔案',
      items: [
        {
          icon: <FileSpreadsheetIcon />,
          title: '上傳試算表',
          description: '支援 .csv、.xls、.xlsx、.xlsm、.xlsb...',
        },
        {
          icon: <FileTextIcon />,
          title: '上傳文件',
          description: '支援 20 多種文件格式',
        },
        {
          icon: <FileJsonIcon />,
          title: '從模板文件上傳',
          description: '.csv 和 .json 格式',
        },
        {
          icon: <VideoIcon />,
          title: '轉錄音訊/視訊',
          description: '長度最多 15 分鐘',
        },
      ],
    },
    {
      title: '手動輸入',
      items: [
        {
          icon: <EditIcon />,
          title: '編寫新的知識庫文檔',
          description: '手動輸入文檔',
        },
      ],
    },
  ];

  return (
    <Box sx={{ p: 6 }}>
      <Typography variant="h3" fontWeight="bold" mb={4}>
        知識庫
      </Typography>
      <Box sx={{ mb: 4 }}>
        <Button variant="contained">新增知識</Button>
        <Button variant="outlined" sx={{ ml: 2 }}>
          現有知識
        </Button>
      </Box>
      <Divider sx={{ mb: 6 }} />
      <Typography variant="h4" fontWeight="bold" mb={4}>
        新增知識
      </Typography>
      {sections.map((section, index) => (
        <Box key={index} sx={{ mb: 8 }}>
          <Typography variant="h5" fontWeight="bold" mb={3}>
            {section.title}
          </Typography>
          <Grid container spacing={4}>
            {section.items.map((item, itemIndex) => (
              <Grid item xs={12} md={6} lg={3} key={itemIndex}>
                <KnowledgeBaseItem
                  icon={item.icon}
                  title={item.title}
                  description={item.description}
                />
              </Grid>
            ))}
          </Grid>
        </Box>
      ))}
    </Box>
  );
};

export default KnowledgeBaseUI;
