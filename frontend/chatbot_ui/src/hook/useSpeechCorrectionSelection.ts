import { useCallback, useState } from 'react';

export function useSpeechCorrectionSelection() {
  const [selectedText, setSelectedText] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectionRange, setSelectionRange] = useState<Range | null>(null);

  const openWithSelection = useCallback((text: string, range: Range | null) => {
    const trimmed = (text || '').trim();
    if (!trimmed) return;
    setSelectedText(trimmed);
    setSelectionRange(range);
    setModalOpen(true);
  }, []);

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      return;
    }
    const text = selection.toString();
    const range =
      selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null;
    openWithSelection(text, range);
  }, [openWithSelection]);

  const close = useCallback(() => {
    setModalOpen(false);
    setSelectedText('');
    setSelectionRange(null);
  }, []);

  return {
    selectedText,
    modalOpen,
    selectionRange,
    setModalOpen,
    openWithSelection,
    handleMouseUp,
    close,
  };
}
