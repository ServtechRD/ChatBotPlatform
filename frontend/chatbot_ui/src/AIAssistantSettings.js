import React from 'react';
import {
  Button,
  Card,
  CardContent,
  Switch,
  Select,
  MenuItem,
  TextField,
  Typography,
  FormControlLabel,
  Box,
} from '@mui/material';

const AIAssistantSettings = () => {
  return (
    <Box sx={{ p: 6, maxWidth: '4xl', mx: 'auto' }}>
      <Typography variant="h4" fontWeight="bold" mb={4}>
        AI助理資訊
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, mb: 6 }}>
        <Button variant="contained">基本設定</Button>
        <Button variant="outlined">設計風格</Button>
        <Button variant="outlined">進階設定</Button>
      </Box>

      <Card>
        <CardContent sx={{ p: 6 }}>
          <Typography variant="h5" fontWeight="semibold" mb={4}>
            基本設定
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={6}>
            AI助理助理資訊提供了AI助理助理的背景資訊。
            <br />
            您提供的描述將用於引導
            LLM，會更改AI助理助理的行為。請仔細考慮並清楚描述您的AI助理助理該使用的背景資訊。
          </Typography>

          <FormControlLabel
            control={<Switch />}
            label="啟用本AI助理"
            sx={{ mb: 6 }}
          />

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Box>
              <Typography variant="subtitle2" mb={1}>
                AI助理名稱*
              </Typography>
              <TextField fullWidth placeholder="TestAgent" />
              <Typography variant="caption" color="text.secondary" mt={1}>
                AI助理助理專屬名稱，若需改動AI助理助理在對話視窗的「顯示名稱」，請前往「帳戶AI助理」進行修改
              </Typography>
            </Box>

            <Box>
              <Typography variant="subtitle2" mb={1}>
                大型語言模型 (LLM)*
              </Typography>
              <Select fullWidth defaultValue="gpt3.5">
                <MenuItem value="gpt3.5">GPT-3.5 Turbo</MenuItem>
              </Select>
              <Typography variant="caption" color="text.secondary" mt={1}>
                *GPT4.0 以上的售更高效能的 LLM 需額外向營運申請購買
              </Typography>
            </Box>

            <Box>
              <Typography variant="subtitle2" mb={1}>
                使用情境*
              </Typography>
              <Select fullWidth defaultValue="customerService">
                <MenuItem value="customerService">Customer Service</MenuItem>
              </Select>
              <Typography variant="caption" color="text.secondary" mt={1}>
                AI助理助理主要使用情境以及使用者知悉與其互動。對於表現演算結果的使用情境，請使用範本填入背景知識。請根據您的需求修改範本中的問題。
              </Typography>
            </Box>

            <Box>
              <Typography variant="subtitle2" mb={1}>
                描述
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={3}
                placeholder="DO:Be friendly and proactive in helping users resolve their issues.
Use casual language and avoid repeating the same sentences."
              />
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Card sx={{ mt: 6 }}>
        <CardContent sx={{ p: 6 }}>
          <Typography variant="h5" fontWeight="semibold" mb={4}>
            預覽AI助理提示指令
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={4}>
            您在左側的回答將用於提示大型語言模型（如 ChatGPT）。
          </Typography>
          <Box sx={{ bgcolor: 'grey.100', p: 4, borderRadius: 1 }}>
            <Typography variant="body2">
              You are a virtual customer service assistant for TestAgent
              engaging in a friendly chat with a customer.
              <br />
              DO:Be friendly and proactive in helping users resolve their
              issues.
              <br />
              Use casual language and avoid repeating the same sentences.
              <br />
              <br />
              DON'T: Provide generic, unhelpful responses.
              <br />
              Ignore or bypass user-specific details in their questions.
              <br />
              <br />
              GOOD EXAMPLE:
              <br />
              User: "What should I do if I receive a damaged product that was a
              gift and I don't have the receipt?"
              <br />
              System: "I'm sorry to hear that you received a damaged product.
              Please email our support team at support@company.com with details
              about the item and any photos of the damage, if possible."
              <br />
              <br />
              BAD EXAMPLE:
              <br />
              User: "What should I do if I receive a damaged product that was a
              gift and I don't have the receipt?"
              <br />
              System: "Sorry, I don't have information on that topic."
            </Typography>
          </Box>
        </CardContent>
      </Card>
      {/* 新增的按鈕部分 */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 4, gap: 2 }}>
        <Button
          variant="outlined"
          color="primary"
          sx={{
            color: 'primary.main',
            borderColor: 'primary.main',
            '&:hover': {
              backgroundColor: 'primary.light',
              borderColor: 'primary.main',
            },
          }}
        >
          重置
        </Button>
        <Button
          variant="contained"
          sx={{
            bgcolor: '#00a86b',
            color: 'white',
            '&:hover': {
              bgcolor: '#008f5b',
            },
          }}
        >
          儲存
        </Button>
      </Box>
    </Box>
  );
};

export default AIAssistantSettings;
