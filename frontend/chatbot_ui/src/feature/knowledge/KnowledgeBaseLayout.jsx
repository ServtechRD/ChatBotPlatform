import React from 'react';
import {
  Button,
  Typography,
  Box,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Folder as FolderIcon,
  RecordVoiceOver as RecordVoiceOverIcon,
} from '@mui/icons-material';
import { NavLink, Outlet, Navigate, useSearchParams } from 'react-router-dom';
import useAuth from '../../hook/useAuth';
import { ROUTES } from '../../constants/routes.js';
import { toWithAssistant } from '../../utils/assistantQuery.js';
import { useAssistant } from '../../context/AssistantContext.jsx';

export default function KnowledgeBaseLayout() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const { currentAgent } = useAssistant();

  const linkTo = path =>
    toWithAssistant(path, searchParams, currentAgent?.assistant_id);

  if (user?.permission_level < 2) {
    return (
      <Navigate
        to={toWithAssistant(
          ROUTES.home,
          searchParams,
          currentAgent?.assistant_id
        )}
        replace
      />
    );
  }

  return (
    <Box sx={{ p: 6 }}>
      <Typography variant="h3" fontWeight="bold" mb={4}>
        知識庫
      </Typography>

      <Box sx={{ mb: 4, display: 'flex', gap: 2 }}>
        <Button
          component={NavLink}
          to={linkTo(ROUTES.knowledgeNew)}
          variant="outlined"
          startIcon={<AddIcon />}
          disabled={user?.permission_level < 2}
          sx={{
            '&.active': {
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              '&:hover': { bgcolor: 'primary.dark' },
            },
          }}
        >
          新增知識
        </Button>
        <Button
          component={NavLink}
          to={linkTo(ROUTES.knowledgeExisting)}
          startIcon={<FolderIcon />}
          sx={{
            '&.active': {
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              '&:hover': { bgcolor: 'primary.dark' },
            },
          }}
        >
          現有知識
        </Button>
        <Button
          component={NavLink}
          to={linkTo(ROUTES.knowledgeSpeechCorrection)}
          variant="outlined"
          startIcon={<RecordVoiceOverIcon />}
          sx={{
            '&.active': {
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              '&:hover': { bgcolor: 'primary.dark' },
            },
          }}
        >
          語音誤字對照表
        </Button>
      </Box>

      <Divider sx={{ mb: 4 }} />
      <Outlet />
    </Box>
  );
}
