// /packages/web/src/components/layout/FullScreenLoader.jsx
import React from 'react';
import { Loader2 } from 'lucide-react';

export const FullScreenLoader = () => {
  return (
    <div className="flex items-center justify-center h-screen w-full">
      <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
    </div>
  );
};
