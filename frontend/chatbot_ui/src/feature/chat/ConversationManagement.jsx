import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  CircularProgress,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { auth } from '../../api/auth.js';
import { useConversationsQuery } from '../../queries/conversation';
import { useSpeechCorrectionRules } from '../../hook/useSpeechCorrectionRules';
import { useSpeechCorrectionRuleModal } from '../../hook/useSpeechCorrectionRuleModal';
import { useSpeechCorrectionSelection } from '../../hook/useSpeechCorrectionSelection';
import SpeechCorrectionSelectionModal from '../speechCorrection/SpeechCorrectionSelectionModal';
import SpeechRulesModal from '../speechCorrection/SpeechRulesModal';
import { getSpeechCorrectionErrorMessage } from '../speechCorrection/speechCorrectionErrors';
import { useAssistant } from '../../context/AssistantContext.jsx';

function ConversationDialog({ open, conversation, onClose, assistantId }) {
  const { groups, refresh, createBatch, saveGroup } =
    useSpeechCorrectionRules(assistantId);
  const selection = useSpeechCorrectionSelection();
  const ruleModal = useSpeechCorrectionRuleModal();
  const [selectionSubmitting, setSelectionSubmitting] = useState(false);
  const [selectionError, setSelectionError] = useState(null);
  const [rulesSubmitting, setRulesSubmitting] = useState(false);
  const [rulesSubmitError, setRulesSubmitError] = useState(null);
  const pendingSelectedTextRef = useRef('');

  useEffect(() => {
    if (open && assistantId) {
      refresh({ enabledOnly: false });
    }
  }, [open, assistantId, refresh]);

  function handleSelectionMouseUp() {
    const text = window.getSelection()?.toString()?.trim();
    if (!text) return;
    pendingSelectedTextRef.current = text;
    selection.openWithSelection(text, null);
  }

  function handleOpenCreateFromSelection() {
    const text =
      pendingSelectedTextRef.current || selection.selectedText || '';
    selection.close();
    ruleModal.openCreate({
      wrongTexts: text ? [text] : [],
      correctText: '',
      enabled: true,
    });
  }

  async function handleConfirmExisting(correctText) {
    const wrongText =
      pendingSelectedTextRef.current || selection.selectedText || '';
    if (!wrongText) return;
    setSelectionSubmitting(true);
    setSelectionError(null);
    try {
      await createBatch({
        correctText,
        wrongTexts: [wrongText],
      });
      selection.close();
      pendingSelectedTextRef.current = '';
    } catch (err) {
      setSelectionError(getSpeechCorrectionErrorMessage(err));
    } finally {
      setSelectionSubmitting(false);
    }
  }

  async function handleRulesModalSubmit() {
    if (!assistantId) {
      setRulesSubmitError('請先選擇助理');
      return;
    }
    const { correctText, wrongTexts, enabled } = ruleModal.formState;
    const trimmedCorrect = correctText.trim();
    const normalizedWrong = wrongTexts.map((w) => w.trim()).filter(Boolean);

    if (!trimmedCorrect || normalizedWrong.length === 0) {
      setRulesSubmitError('請填寫正確關鍵字與至少一個可能錯誤文字');
      return;
    }

    setRulesSubmitting(true);
    setRulesSubmitError(null);

    try {
      const oldCorrectText =
        ruleModal.editingGroupRules?.[0]?.correctText ??
        ruleModal.editingRule?.correctText ??
        trimmedCorrect;
      const replacedRuleIds =
        ruleModal.editingGroupRules?.map((r) => r.id) ??
        (ruleModal.editingRule ? [ruleModal.editingRule.id] : []);

      await saveGroup(
        {
          assistantId,
          oldCorrectText,
          correctText: trimmedCorrect,
          enabled,
          wrongTexts: normalizedWrong,
        },
        replacedRuleIds
      );
      ruleModal.close();
      pendingSelectedTextRef.current = '';
    } catch (err) {
      setRulesSubmitError(getSpeechCorrectionErrorMessage(err));
    } finally {
      setRulesSubmitting(false);
    }
  }

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
        <DialogTitle>
          對話紀錄 - 客戶 ID: {conversation?.customer_id}
        </DialogTitle>
        <DialogContent>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            可選取訊息文字以建立語音誤字對照
          </Typography>
          <Box
            onMouseUp={handleSelectionMouseUp}
            sx={{
              maxHeight: 400,
              overflowY: 'auto',
              bgcolor: '#f5f5f5',
              p: 2,
              borderRadius: 1,
              userSelect: 'text',
            }}
          >
            {conversation?.messages?.map(message => {
              const isAssistant = message.sender === '助理';
              return (
                <Box
                  key={message.message_id}
                  sx={{
                    display: 'flex',
                    justifyContent: isAssistant ? 'flex-start' : 'flex-end',
                    mb: 1.5,
                  }}
                >
                  <Box
                    sx={{
                      maxWidth: '80%',
                      bgcolor: isAssistant ? 'white' : 'primary.main',
                      color: isAssistant
                        ? 'text.primary'
                        : 'primary.contrastText',
                      p: 1.5,
                      borderRadius: 2,
                      boxShadow: 1,
                    }}
                  >
                    <Typography
                      variant="caption"
                      color={isAssistant ? 'text.secondary' : 'inherit'}
                      sx={{ display: 'block', mb: 0.5 }}
                    >
                      {message.sender}
                    </Typography>
                    <Box
                      sx={{
                        '& p': { margin: 0 },
                      }}
                    >
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {message.content ?? ''}
                      </ReactMarkdown>
                    </Box>
                    <Typography
                      variant="caption"
                      color={isAssistant ? 'text.secondary' : 'inherit'}
                      sx={{ display: 'block', mt: 0.5, textAlign: 'right' }}
                    >
                      {new Date(message.timestamp + 'Z').toLocaleString()}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
            {!conversation?.messages?.length && (
              <Typography color="text.secondary" align="center">
                目前沒有對話訊息
              </Typography>
            )}
          </Box>
        </DialogContent>
      </Dialog>

      <SpeechCorrectionSelectionModal
        open={selection.modalOpen}
        selectedText={selection.selectedText}
        onClose={() => {
          selection.close();
          setSelectionError(null);
          pendingSelectedTextRef.current = '';
        }}
        groups={groups}
        onOpenCreateModal={handleOpenCreateFromSelection}
        onConfirmExisting={handleConfirmExisting}
        submitting={selectionSubmitting}
        error={selectionError}
      />

      <SpeechRulesModal
        open={ruleModal.modalOpen}
        onClose={() => {
          setRulesSubmitError(null);
          ruleModal.close();
        }}
        title={
          ruleModal.isEditing ? '新增／編輯關鍵字對照' : '新增關鍵字對照'
        }
        formState={ruleModal.formState}
        onPatchForm={ruleModal.patchForm}
        onSubmit={handleRulesModalSubmit}
        submitting={rulesSubmitting}
        submitError={rulesSubmitError}
      />
    </>
  );
}

export default function ConversationManagement() {
  const { currentAgent: currentAssistant } = useAssistant();
  const assistantId = currentAssistant?.assistant_id;
  const {
    data: conversations = [],
    isLoading: isLoadingConversations,
    error: queryError,
    refetch: fetchConversations,
    isFetching,
  } = useConversationsQuery(assistantId, { enabled: !!assistantId });
  const error = useMemo(() => {
    if (!queryError) return null;
    return '無法讀取對話列表，請稍後再試';
  }, [queryError]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  function handleOpenConversation(conversation) {
    setSelectedConversation(conversation);
    setIsModalOpen(true);
  }

  function handleCloseModal() {
    setIsModalOpen(false);
    setSelectedConversation(null);
  }

  useEffect(() => {
    if (queryError) {
      console.error('Error fetching conversations:', queryError);
      handleApiError(queryError);
    }
  }, [queryError]);

  function handleDownloadCSV() {
    const csvData = [];
    csvData.push([
      'customer_id',
      'conversation_id',
      'content',
      'sender',
      'time',
    ]);

    conversations.forEach(conversation => {
      conversation.messages.forEach(message => {
        csvData.push([
          conversation.customer_id,
          conversation.conversation_id,
          message.content,
          message.sender,
          message.timestamp,
        ]);
      });
    });

    const csvContent = csvData
      .map(row => row.map(cell => `"${cell}"`).join('|'))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], {
      type: 'text;charset=utf-8;',
    });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `conversations_${currentAssistant?.assistant_id}.txt`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function getMessageCount(messages) {
    return messages?.length || 0;
  }

  function handleApiError(error) {
    if (error.response && error.response.status === 401) {
      auth.logout();
      // navigate('/login');
    }
  }

  function handleSearchChange(event) {
    setSearchTerm(event.target.value);
  }

  function getFilteredConversations() {
    if (!searchTerm) return conversations;

    return conversations.filter(conversation =>
      conversation.customer_id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  if (!currentAssistant) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary">請先選擇一個助理</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, height: '100vh', overflow: 'auto' }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
          {currentAssistant.name || '對話管理'} - 對話列表
        </Typography>
        <Box>
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={handleDownloadCSV}
            sx={{ mr: 1 }}
            disabled={conversations.length === 0}
          >
            下載對話紀錄
          </Button>
          <IconButton
            onClick={fetchConversations}
            disabled={isLoadingConversations || isFetching}
          >
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      <TextField
        fullWidth
        variant="outlined"
        placeholder="搜尋客戶 ID"
        size="small"
        value={searchTerm}
        onChange={handleSearchChange}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
        sx={{ mb: 2 }}
      />

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      {isLoadingConversations ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      ) : getFilteredConversations().length === 0 ? (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            mt: 4,
            color: 'text.secondary',
          }}
        >
          <Typography>
            {searchTerm ? '沒有找到符合的對話' : '目前沒有對話記錄'}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {getFilteredConversations().map(conversation => (
            <Box
              key={conversation.conversation_id}
              onClick={() => handleOpenConversation(conversation)}
              sx={{
                p: 2,
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
                cursor: 'pointer',
                '&:hover': {
                  bgcolor: 'action.hover',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography
                  variant="subtitle1"
                  sx={{ fontWeight: 'bold', mr: 2 }}
                >
                  客戶 ID: {conversation.customer_id}
                </Typography>
                <Chip
                  label={`${getMessageCount(conversation.messages)} 則訊息`}
                  size="small"
                  color="primary"
                />
              </Box>
              <Typography variant="caption" color="text.secondary">
                建立時間:{' '}
                {new Date(conversation.created_at + 'Z').toLocaleString()}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
      <ConversationDialog
        open={isModalOpen}
        conversation={selectedConversation}
        onClose={handleCloseModal}
        assistantId={currentAssistant?.assistant_id}
      />
    </Box>
  );
}
