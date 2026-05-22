import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function IconWrapper({ children }) {
  return (
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
}

export default function KnowledgeBaseItem({ icon, title, description, onClick }) {
  return (
    <Card sx={{ height: '100%', cursor: 'pointer' }} onClick={onClick}>
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
            fontSize: '0.875rem',
          }}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {description ?? ''}
          </ReactMarkdown>
        </Box>
      </CardContent>
    </Card>
  );
}
