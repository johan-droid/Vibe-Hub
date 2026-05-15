import React, { useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';

export function CommandOrbNode({ data }) {
  const [inputValue, setInputValue] = useState('');
  const { setCenter, getNodes } = useReactFlow();

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (inputValue.startsWith('/find ')) {
        const filename = inputValue.replace('/find ', '').trim();
        const nodes = getNodes();
        const targetNode = nodes.find(n =>
          n.data?.label?.toLowerCase().includes(filename.toLowerCase()) ||
          n.id === filename ||
          n.data?.path?.toLowerCase().includes(filename.toLowerCase()) ||
          n.data?.name?.toLowerCase().includes(filename.toLowerCase())
        );

        if (targetNode) {
          const x = targetNode.position.x + (targetNode.width || 200) / 2;
          const y = targetNode.position.y + (targetNode.height || 100) / 2;
          setCenter(x, y, { zoom: 1.5, duration: 800 });
        }
      }
      setInputValue('');
    }
  };

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] p-3 shadow-2xl backdrop-blur-xl"
    >
      <Search size={16} className="text-white/50" />
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type /find [filename]..."
        className="w-64 bg-transparent text-sm font-medium text-white outline-none placeholder:text-white/30"
      />
    </motion.div>
  );
}
