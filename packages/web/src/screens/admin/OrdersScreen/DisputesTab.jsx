import React from 'react';
import { AlertTriangle, ExternalLink, Clock, CheckCircle, XCircle } from 'lucide-react';

const DISPUTE_STATUS_STYLES = {
  needs_response: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', label: 'Needs Response' },
  under_review: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', label: 'Under Review' },
  won: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', label: 'Won' },
  lost: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', label: 'Lost' },
  warning_closed: { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200', label: 'Closed' },
};

const DISPUTE_REASONS = {
  credit_not_processed: 'Credit not processed',
  duplicate: 'Duplicate charge',
  fraudulent: 'Fraudulent',
  general: 'General',
  product_not_received: 'Product not received',
  product_unacceptable: 'Product unacceptable',
  subscription_canceled: 'Subscription canceled',
  unrecognized: 'Unrecognized',
};

export const DisputesTab = ({ disputes, gymId, primaryColor }) => {
  const formatDate = (date) => {
    if (!date) return '—';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (disputes.length === 0) {
    return (
      <div className="text-center py-16 bg-gray-50 rounded-xl border border-gray-100">
        <CheckCircle size={48} className="mx-auto text-green-300 mb-4" />
        <p className="text-gray-500 font-medium">No active disputes</p>
        <p className="text-gray-400 text-sm mt-1">
          Disputes will appear here if a customer files a chargeback.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Warning Banner */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-amber-800">Dispute Management</p>
            <p className="text-sm text-amber-700 mt-1">
              Disputes require prompt attention. You have limited time to respond with evidence.
              For detailed dispute management, use the Stripe Dashboard.
            </p>
            <a
              href="https://dashboard.stripe.com/disputes"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-bold text-amber-700 hover:text-amber-900 mt-2"
            >
              Open Stripe Dashboard <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </div>

      {/* Disputes List */}
      {disputes.map((dispute) => {
        const statusStyle = DISPUTE_STATUS_STYLES[dispute.disputeStatus] || DISPUTE_STATUS_STYLES.needs_response;
        const isActive = !['won', 'lost', 'warning_closed'].includes(dispute.disputeStatus);

        return (
          <div
            key={dispute.id}
            className={`bg-white rounded-xl border shadow-sm overflow-hidden ${isActive ? 'border-red-200' : 'border-gray-100'}`}
          >
            {/* Dispute Header */}
            <div className={`p-4 ${isActive ? 'bg-red-50/50' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${statusStyle.bg}`}>
                    {dispute.disputeStatus === 'won' ? (
                      <CheckCircle size={20} className={statusStyle.text} />
                    ) : dispute.disputeStatus === 'lost' ? (
                      <XCircle size={20} className={statusStyle.text} />
                    ) : (
                      <AlertTriangle size={20} className={statusStyle.text} />
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">
                      Order #{dispute.orderId?.slice(-8).toUpperCase() || 'Unknown'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {dispute.memberName || 'Unknown'} • {formatDate(dispute.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-bold text-red-600">${dispute.amount?.toFixed(2)}</p>
                    <p className="text-xs text-gray-500">Disputed amount</p>
                  </div>
                  <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${statusStyle.bg} ${statusStyle.text} border ${statusStyle.border}`}>
                    {statusStyle.label}
                  </span>
                </div>
              </div>
            </div>

            {/* Dispute Details */}
            <div className="p-4 border-t border-gray-100 bg-gray-50/50">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Reason</p>
                  <p className="text-sm text-gray-900 mt-1">
                    {DISPUTE_REASONS[dispute.disputeReason] || dispute.disputeReason || 'Unknown'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Dispute ID</p>
                  <p className="text-sm text-gray-900 mt-1 font-mono">
                    {dispute.disputeId?.slice(0, 20) || '—'}...
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Filed On</p>
                  <p className="text-sm text-gray-900 mt-1">{formatDate(dispute.disputeCreatedAt || dispute.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Evidence Due</p>
                  <p className={`text-sm mt-1 font-medium ${dispute.evidenceDueBy && new Date(dispute.evidenceDueBy) < new Date() ? 'text-red-600' : 'text-gray-900'}`}>
                    {dispute.evidenceDueBy ? formatDate(dispute.evidenceDueBy) : '—'}
                  </p>
                </div>
              </div>

              {/* Action Button for Active Disputes */}
              {isActive && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <a
                    href={`https://dashboard.stripe.com/disputes/${dispute.disputeId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-bold text-sm rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Respond in Stripe <ExternalLink size={14} />
                  </a>
                  <p className="text-xs text-gray-500 mt-2">
                    Submit evidence and respond to this dispute through Stripe's dispute management interface.
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
