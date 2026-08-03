import React, { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import { auth } from '../services/api/auth.js';

export default function AccountSettingsDialog({ open, onClose, user }) {
  const [name, setName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(user?.name ?? '');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setError('');
    }
  }, [open, user]);

  async function handleSave() {
    setError('');
    const pwdTouched =
      currentPassword.trim() || newPassword.trim() || confirmPassword.trim();

    if (pwdTouched) {
      if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
        setError('變更密碼時請填寫目前密碼、新密碼與確認新密碼');
        return;
      }
      if (newPassword !== confirmPassword) {
        setError('兩次輸入的新密碼不一致');
        return;
      }
    }

    setSaving(true);
    try {
      const payload = { name: name ?? '' };
      if (pwdTouched) {
        payload.current_password = currentPassword;
        payload.new_password = newPassword;
      }
      await auth.updateProfile(payload);
      onClose(true);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(
        typeof detail === 'string' ? detail : '儲存失敗，請稍後再試'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={() => onClose(false)} fullWidth maxWidth="sm">
      <DialogTitle>帳戶設定</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <TextField
          margin="dense"
          label="使用者 ID"
          fullWidth
          value={user?.user_id ?? ''}
          InputProps={{ readOnly: true }}
        />
        <TextField
          margin="dense"
          label="Email（登入帳號）"
          fullWidth
          value={user?.email ?? ''}
          InputProps={{ readOnly: true }}
        />
        <TextField
          margin="dense"
          label="顯示名稱"
          fullWidth
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
          變更密碼（選填，三欄皆空則不改密碼）
        </Typography>
        <TextField
          margin="dense"
          label="目前密碼"
          type="password"
          fullWidth
          value={currentPassword}
          onChange={e => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
        />
        <TextField
          margin="dense"
          label="新密碼"
          type="password"
          fullWidth
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
          autoComplete="new-password"
        />
        <TextField
          margin="dense"
          label="確認新密碼"
          type="password"
          fullWidth
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose(false)} disabled={saving}>
          取消
        </Button>
        <Button onClick={handleSave} variant="contained" disabled={saving}>
          {saving ? '儲存中...' : '儲存'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
