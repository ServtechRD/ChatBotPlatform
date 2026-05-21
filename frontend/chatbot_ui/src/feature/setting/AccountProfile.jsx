import React, { useState } from 'react';
import { 
  TextField, 
  Button, 
  Card, 
  CardContent, 
  Typography, 
  Grid, 
  Box,
  InputAdornment
} from '@mui/material';
import { 
  Email as EmailIcon, 
  Lock as LockIcon, 
  Person as PersonIcon, 
  Phone as PhoneIcon 
} from '@mui/icons-material';

const AccountProfile = () => {
  const [profile, setProfile] = useState({
    email: 'jacokao5@gmail.com',
    firstName: 'kao',
    lastName: 'jaco',
    phone: ''
  });

  const handleChange = (e) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Here you would typically send the updated profile to your backend
    console.log('Profile updated:', profile);
  };

  return (
    <Box sx={{ p: 6, maxWidth: '4xl', mx: 'auto' }}>
      <Typography variant="h4" fontWeight="bold" mb={6}>帳戶</Typography>
      <Card>
        <CardContent sx={{ p: 6 }}>
          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField 
                  fullWidth
                  type="email" 
                  name="email" 
                  value={profile.email} 
                  onChange={handleChange}
                  disabled
                  label="電子信箱"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField 
                  fullWidth
                  type="password" 
                  value="********" 
                  disabled
                  label="密碼"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField 
                  fullWidth
                  type="text" 
                  name="firstName" 
                  value={profile.firstName} 
                  onChange={handleChange}
                  label="名"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField 
                  fullWidth
                  type="text" 
                  name="lastName" 
                  value={profile.lastName} 
                  onChange={handleChange}
                  label="姓"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField 
                  fullWidth
                  type="tel" 
                  name="phone" 
                  value={profile.phone} 
                  onChange={handleChange}
                  label="電話號碼"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PhoneIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
            </Grid>
            <Box sx={{ mt: 6, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Button variant="outlined">重置</Button>
              <Button variant="contained" type="submit">儲存</Button>
            </Box>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};

export default AccountProfile;
