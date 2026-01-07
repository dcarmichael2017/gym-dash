import React, { createContext, useContext, useState, useRef } from 'react';
import { X, AlertTriangle, CheckCircle, Info } from 'lucide-react';

const ConfirmationContext = createContext();

export const useConfirm = () => useContext(ConfirmationContext);

export const ConfirmationProvider = ({ children }) => {
    const [dialog, setDialog] = useState({
        isOpen: false,
        title: '',
        message: '',
        type: 'confirm', 
        confirmText: 'Confirm',
        cancelText: 'Cancel',
        closeOnOverlayClick: true
    });

    const resolver = useRef(null);

    const confirm = ({
        title = "Are you sure?",
        message = "This action cannot be undone.",
        type = "confirm",
        confirmText = "Confirm",
        cancelText = "Cancel",
        closeOnOverlayClick = true
    }) => {
        setDialog({ isOpen: true, title, message, type, confirmText, cancelText, closeOnOverlayClick });

        return new Promise((resolve) => {
            resolver.current = resolve;
        });
    };

    const alert = ({ title, message }) => {
        return confirm({
            title,
            message,
            type: 'alert',
            confirmText: 'OK',
            cancelText: null,
            closeOnOverlayClick: true
        });
    };

    const handleClose = (result) => {
        setDialog(prev => ({ ...prev, isOpen: false }));
        if (resolver.current) {
            resolver.current(result);
        }
    };

    const handleOverlayClick = () => {
        if (dialog.closeOnOverlayClick) {
            // ✅ CHANGE: Resolve as NULL (Dismissed) instead of false
            handleClose(null); 
        }
    };

    return (
        <ConfirmationContext.Provider value={{ confirm, alert }}>
            {children}

            {dialog.isOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
                        onClick={handleOverlayClick}
                    />

                    <div 
                        className="relative bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200 border border-gray-100"
                        onClick={(e) => e.stopPropagation()} 
                    >
                        <div className="flex flex-col items-center text-center">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
                                dialog.type === 'danger' ? 'bg-red-100 text-red-600' :
                                dialog.type === 'alert' ? 'bg-blue-100 text-blue-600' :
                                'bg-yellow-100 text-yellow-600'
                            }`}>
                                {dialog.type === 'danger' ? <AlertTriangle size={24} /> :
                                dialog.type === 'alert' ? <Info size={24} /> :
                                <AlertTriangle size={24} />}
                            </div>

                            <h3 className="text-lg font-bold text-gray-900 mb-2">
                                {dialog.title}
                            </h3>

                            <div className="text-sm text-gray-500 mb-6">
                                {dialog.message}
                            </div>

                            <div className="flex gap-3 w-full">
                                {dialog.cancelText && (
                                    <button
                                        // ✅ NOTE: Explicit Cancel button still sends FALSE
                                        onClick={() => handleClose(false)}
                                        className="flex-1 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                                    >
                                        {dialog.cancelText}
                                    </button>
                                )}

                                <button
                                    onClick={() => handleClose(true)}
                                    className={`flex-1 px-4 py-2 rounded-lg text-white font-medium shadow-sm transition-colors ${
                                        dialog.type === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                                    }`}
                                >
                                    {dialog.confirmText}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmationContext.Provider>
    );
};