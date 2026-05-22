import React, { useState } from 'react';
import { Typography, Grid, Box } from '@mui/material';
import { Description as FileTextIcon, Edit as EditIcon } from '@mui/icons-material';
import KnowledgeBaseItem from './KnowledgeBaseItem';
import FileUploadDialog from './FileUploadDialog';
import TextInputDialog from './TextInputDialog';
import { useAssistant } from '../../context/AssistantContext.jsx';

export default function KnowledgeNewPage() {
  const { currentAgent } = useAssistant();
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isTextDialogOpen, setIsTextDialogOpen] = useState(false);
  const [uploadType, setUploadType] = useState(null);

  const assistantId = currentAgent?.assistant_id;

  function handleKnowledgeItemClick(type) {
    setUploadType(type);
    if (type === '上傳文件') setIsUploadDialogOpen(true);
    else setIsTextDialogOpen(true);
  }

  const sections = [
    {
      title: '上傳',
      items: [
        {
          icon: <FileTextIcon />,
          title: '上傳文件',
          description: '支援 pdf / docx / txt',
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
    <>
      <Typography variant="h4" fontWeight="bold" mb={4}>
        新增知識
      </Typography>
      {sections.map((section, i) => (
        <Box key={i} sx={{ mb: 8 }}>
          <Typography variant="h5" fontWeight="bold" mb={3}>
            {section.title}
          </Typography>
          <Grid container spacing={4}>
            {section.items.map((item, j) => (
              <Grid item xs={12} md={6} lg={3} key={j}>
                <KnowledgeBaseItem
                  icon={item.icon}
                  title={item.title}
                  description={item.description}
                  onClick={() => handleKnowledgeItemClick(item.title)}
                />
              </Grid>
            ))}
          </Grid>
        </Box>
      ))}

      <FileUploadDialog
        isOpen={isUploadDialogOpen}
        onClose={() => setIsUploadDialogOpen(false)}
        onUploadComplete={() => setIsUploadDialogOpen(false)}
        uploadType={uploadType}
        assistantId={assistantId}
      />
      <TextInputDialog
        isOpen={isTextDialogOpen}
        onClose={() => {
          setIsTextDialogOpen(false);
          setUploadType(null);
        }}
        onSubmitComplete={() => {
          setIsTextDialogOpen(false);
          setUploadType(null);
        }}
        assistantId={assistantId}
        initialContent=""
        initialFileName=""
        isEditMode={false}
        knowledgeId={undefined}
        isLoadingEditContent={false}
      />
    </>
  );
}
