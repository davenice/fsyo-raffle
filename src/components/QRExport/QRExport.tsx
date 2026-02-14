import { useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { RaffleTicket } from '../../types';
import {
  encodeTickets,
  estimateQRSize,
  MAX_SAFE_BYTES,
} from '../../utils/ticketTransfer';
import './QRExport.css';

interface QRExportProps {
  tickets: RaffleTicket[];
  onClose: () => void;
}

export function QRExport({ tickets, onClose }: QRExportProps) {
  const encoded = useMemo(() => encodeTickets(tickets), [tickets]);
  const dataSize = estimateQRSize(tickets);
  const isOversize = dataSize > MAX_SAFE_BYTES;

  return (
    <div className="qr-export-modal">
      <div className="qr-export-header">
        <span className="qr-export-title">[ EXPORT TICKETS ]</span>
        <button className="qr-export-close" onClick={onClose}>
          [X]
        </button>
      </div>

      <div className="qr-export-content">
        {tickets.length === 0 ? (
          <div className="qr-export-empty">
            <pre>
              {`
┌─────────────────────────────┐
│  No tickets to export...    │
└─────────────────────────────┘`}
            </pre>
          </div>
        ) : isOversize ? (
          <div className="qr-export-warning">
            <p>Too many tickets ({tickets.length}) for single QR code.</p>
            <p>Maximum ~130 tickets supported.</p>
          </div>
        ) : (
          <>
            <div className="qr-code-container">
              <QRCodeSVG
                value={encoded}
                size={400}
                level="H"
                bgColor="#ffffff"
                fgColor="#000000"
                className="qr-code"
              />
            </div>
            <div className="qr-export-info">
              <p>
                {tickets.length} ticket{tickets.length !== 1 ? 's' : ''}
              </p>
              <p className="qr-hint">Scan this QR code on your laptop</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
