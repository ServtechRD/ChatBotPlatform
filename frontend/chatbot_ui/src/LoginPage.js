import React, { useState } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Container,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  InputAdornment,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  Visibility,
  VisibilityOff,
  Close as CloseIcon,
} from '@mui/icons-material';

import ApiService from './path/to/ApiService';

const Logo = styled('img')({
  width: 150,
  height: 'auto',
  marginBottom: 20,
});

const LoginPage = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [openRegister, setOpenRegister] = useState(false);
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');

  const handleLogin = async e => {
    e.preventDefault();
    try {
      const response = await ApiService.login(email, password);
      onLogin(response.token);
    } catch (error) {
      alert('登入失敗，請檢查您的輸入。');
    }
  };

  const handleRegister = async () => {
    try {
      await ApiService.register(registerEmail, registerPassword);
      alert('註冊成功！請使用新帳號登入。');
      setOpenRegister(false);
    } catch (error) {
      alert('註冊失敗，請稍後再試。');
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Logo src="/assets/images/logo.png" alt="System Logo" />
        <Typography component="h1" variant="h5">
          登入
        </Typography>
        <Box component="form" onSubmit={handleLogin} noValidate sx={{ mt: 1 }}>
          <TextField
            margin="normal"
            required
            fullWidth
            id="email"
            label="電子郵件地址"
            name="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            name="password"
            label="密碼"
            type={showPassword ? 'text' : 'password'}
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            color="primary" // 使用 primary color
            sx={{
              mt: 3,
              mb: 2,
            }}
          >
            登入
          </Button>
          <Button
            fullWidth
            variant="outlined"
            sx={{ mt: 1, mb: 2 }}
            onClick={() => setOpenRegister(true)}
          >
            註冊新帳號
          </Button>
        </Box>
      </Box>

      <Dialog open={openRegister} onClose={() => setOpenRegister(false)}>
        <DialogTitle>
          註冊
          <IconButton
            aria-label="close"
            onClick={() => setOpenRegister(false)}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            id="register-email"
            label="電子郵件地址"
            type="email"
            fullWidth
            variant="outlined"
            value={registerEmail}
            onChange={e => setRegisterEmail(e.target.value)}
          />
          <TextField
            margin="dense"
            id="register-password"
            label="密碼"
            type="password"
            fullWidth
            variant="outlined"
            value={registerPassword}
            onChange={e => setRegisterPassword(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenRegister(false)}>取消</Button>
          <Button
            onClick={handleRegister}
            variant="contained"
            sx={{ bgcolor: '#00a86b', '&:hover': { bgcolor: '#008f5b' } }}
          >
            註冊
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default LoginPage;
