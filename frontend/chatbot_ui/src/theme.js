import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  // 在这里自定义您的主题
  palette: {
    primary: {
      main: '#556cd6',
    },
    secondary: {
      main: '#19857b',
    },
    error: {
      main: '#ff1744',
    },
    background: {
      default: '#fff',
    },
  },
});

export default theme;
