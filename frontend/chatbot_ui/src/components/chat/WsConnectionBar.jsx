import { Box, Button, Typography } from '@mui/material';

import {
  getWsConnectionLabel,
  shouldShowReconnectButton,
} from '../../utils/wsChatUi';

export function WsConnectionBar({ status, notice, onReconnect }) {
  const showReconnect = shouldShowReconnectButton(status);
  const showStatus = status !== 'connected';
  const showBar = showStatus || Boolean(notice);

  if (!showBar) return null;

  return (
    <Box sx={{ px: 2, pb: 0.5 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          flexWrap: 'wrap',
        }}
      >
        {showStatus && (
          <Typography
            variant="caption"
            sx={{
              color: status === 'connecting' ? 'warning.light' : 'error.light',
              textShadow: '1px 1px 2px rgba(0,0,0,0.6)',
            }}
          >
            {getWsConnectionLabel(status)}
          </Typography>
        )}
        {showReconnect && onReconnect && (
          <Button
            size="small"
            variant="outlined"
            onClick={onReconnect}
            sx={{
              color: 'white',
              borderColor: 'rgba(255,255,255,0.6)',
              py: 0,
              minHeight: 28,
              fontSize: '0.75rem',
            }}
          >
            重新連線
          </Button>
        )}
      </Box>
      {notice && (
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mt: 0.5,
            color: 'error.light',
            textShadow: '1px 1px 2px rgba(0,0,0,0.6)',
          }}
        >
          {notice}
        </Typography>
      )}
    </Box>
  );
}
