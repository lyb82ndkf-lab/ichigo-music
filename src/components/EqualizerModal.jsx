import React from 'react';
import EqualizerPanel from './EqualizerPanel';

export default function EqualizerModal({ isOpen, onClose }) {
  if (!isOpen) return null;
  return <EqualizerPanel isModal={true} onClose={onClose} />;
}
