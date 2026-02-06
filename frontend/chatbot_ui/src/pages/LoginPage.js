import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  TextField,
  Typography,
  Container,
  Dialog,
  DialogTitle,
  IconButton,
  DialogContent,
  DialogActions,
  InputAdornment,
  Alert,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  Visibility,
  VisibilityOff,
  Close as CloseIcon,
} from '@mui/icons-material';

import useAuth from '../hook/useAuth';
import ApiService from '../api/ApiService';

const Logo = styled('img')({
  width: 150,
  height: 'auto',
  marginBottom: 20,
});

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [openRegister, setOpenRegister] = useState(false);
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');

  // MFA State
  const [mfaStage, setMfaStage] = useState('login'); // 'login', 'setup', 'verify'
  const [tempToken, setTempToken] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [mfaSecret, setMfaSecret] = useState('');
  const [mfaCode, setMfaCode] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  async function handleLogin(e) {
    if (e) e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await ApiService.login(email, password);

      // Check for MFA requirements (decision made by backend based on DB)
      if (response.mfa_setup_required) {
        setTempToken(response.temp_token);
        // Start MFA setup flow
        await startMfaSetup(response.temp_token);
        return;
      } else if (response.mfa_required) {
        setTempToken(response.temp_token);
        setMfaStage('verify');
        setIsLoading(false);
        return;
      }

      // Standard Login (MFA not required or disabled for this user)
      const token = response.access_token;
      if (token) {
        await login(token);
        await ApiService.fetchUserData();
        await ApiService.fetchAssistants();
        navigate('/', { replace: true });
      } else {
        // Fallback for unexpected response
        setError('登入回應異常，請聯繫管理員');
      }
    } catch (err) {
      console.error('Login failed:', err);
      // Check for specific error message if available
      const errMsg = err.response?.data?.detail || '登入失敗，請檢查您的帳號和密碼';
      setError(errMsg);
    } finally {
      if (mfaStage === 'login') {
        setIsLoading(false);
      }
    }
  }

  const startMfaSetup = async (token) => {
    try {
      const data = await ApiService.mfaSetupInit(token);
      setQrCode(data.qr_code);
      setMfaSecret(data.secret);
      setMfaStage('setup');
    } catch (err) {
      console.error("MFA Setup Init Error", err);
      setError('MFA 初始化失敗');
      setMfaStage('login');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMfaVerify = async () => {
    setError('');
    setIsLoading(true);
    try {
      let response;
      if (mfaStage === 'setup') {
        response = await ApiService.mfaSetupVerify(tempToken, mfaSecret, mfaCode);
      } else {
        response = await ApiService.verifyMfa(tempToken, mfaCode);
      }

      const token = response.access_token;
      await login(token);
      await ApiService.fetchUserData();
      await ApiService.fetchAssistants();
      navigate('/', { replace: true });

    } catch (err) {
      console.error('MFA Verify failed:', err);
      setError('驗證碼錯誤，請重新輸入');
      setIsLoading(false);
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
          {mfaStage === 'login' ? '登入' : mfaStage === 'setup' ? 'MFA 設定' : '兩步驟驗證'}
        </Typography>

        {mfaStage === 'login' && (
          <Box component="form" onSubmit={handleLogin} noValidate sx={{ mt: 1 }}>
            {/* Display Error if any (shared for all stages if needed, but primarily login) */}
            {error && <Alert severity="error" sx={{ width: '100%', mb: 2 }}>{error}</Alert>}

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
              color="primary"
              disabled={isLoading}
              sx={{ mt: 3, mb: 2 }}
            >
              {isLoading ? '登入中...' : '登入'}
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
        )}

        {(mfaStage === 'setup' || mfaStage === 'verify') && (
          <Box sx={{ mt: 2, width: '100%' }}>
            {error && <Alert severity="error" sx={{ width: '100%', mb: 2 }}>{error}</Alert>}

            {mfaStage === 'setup' && (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 2 }}>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                  為了確保您的帳號安全，請設定兩步驟驗證。
                  <br />請使用 Google Authenticator 掃描下方 QR Code。
                </Typography>
                {qrCode && <img src={qrCode} alt="MFA QR Code" style={{ width: 200, height: 200 }} />}
              </Box>
            )}

            {mfaStage === 'verify' && (
              <Typography variant="body2" color="textSecondary" sx={{ mb: 2, textAlign: 'center' }}>
                請輸入 Google Authenticator 上的 6 位數驗證碼。
              </Typography>
            )}

            <TextField
              margin="normal"
              required
              fullWidth
              id="mfaCode"
              label="驗證碼"
              name="mfaCode"
              autoFocus
              value={mfaCode}
              onChange={e => setMfaCode(e.target.value)}
            />
            <Button
              fullWidth
              variant="contained"
              color="primary"
              onClick={handleMfaVerify}
              disabled={isLoading}
              sx={{ mt: 3, mb: 2 }}
            >
              {isLoading ? '驗證中...' : '送出驗證'}
            </Button>
            <Button
              fullWidth
              variant="text"
              onClick={() => {
                setMfaStage('login');
                setTempToken('');
                setMfaCode('');
                setError('');
              }}
            >
              返回登入
            </Button>
          </Box>
        )}

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
}
