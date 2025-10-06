// /packages/web/src/components/layout/AuthLayout.jsx

import React from 'react';
import { Outlet } from 'react-router-dom';

export const AuthLayout = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        {/* The Outlet component will render the active route/screen */}
        <Outlet />
      </div>
    </div>
  );
};