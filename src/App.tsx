import { useRef, useState, lazy, Suspense } from 'react';
import { COLOURS } from './types';
import type { RaffleColour, RaffleTicket } from './types';
import './App.css';

const Scanner = lazy(() => import('./components/Scanner/Scanner').then(m => ({ default: m.Scanner })));
const QRExport = lazy(() => import('./components/QRExport/QRExport').then(m => ({ default: m.QRExport })));
const QRImport = lazy(() => import('./components/QRImport/QRImport').then(m => ({ default: m.QRImport })));

function App() {
  const [tickets, setTickets] = useState<RaffleTicket[]>([]);
  const [ticketNumber, setTicketNumber] = useState('');
  const [selectedColour, setSelectedColour] = useState<RaffleColour>('Red');
  const [nextId, setNextId] = useState(1);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [qrExportOpen, setQRExportOpen] = useState(false);
  const [qrImportOpen, setQRImportOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const groupedTickets = COLOURS
    .map((colour) => ({
      colour,
      tickets: tickets
        .filter((t) => t.colour === colour)
        .sort((a, b) => {
          const numA = parseInt(a.number, 10);
          const numB = parseInt(b.number, 10);
          if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
          return a.number.localeCompare(b.number);
        }),
    }))
    .filter((group) => group.tickets.length > 0);

  const handleAddTicket = () => {
    if (!ticketNumber.trim()) return;

    const newTicket: RaffleTicket = {
      id: nextId,
      number: ticketNumber.trim(),
      colour: selectedColour,
    };

    setTickets([...tickets, newTicket]);
    setNextId(nextId + 1);
    setTicketNumber('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddTicket();
    }
  };

  const handleRemoveTicket = (id: number) => {
    setTickets(tickets.filter((t) => t.id !== id));
  };

  const handleScanComplete = (number: string, colour: RaffleColour) => {
    const newTicket: RaffleTicket = {
      id: nextId,
      number: number.trim(),
      colour: colour,
    };
    setTickets([...tickets, newTicket]);
    setNextId(nextId + 1);
  };

  const handleImportTickets = (imported: RaffleTicket[]) => {
    const newTickets = imported.map((t, i) => ({
      ...t,
      id: nextId + i,
    }));
    setTickets([...tickets, ...newTickets]);
    setNextId(nextId + imported.length);
    setQRImportOpen(false);
  };

  return (
    <div className="app">
      <div className={`header ${headerCollapsed ? 'collapsed' : ''}`}>
        <div
          className="header-toggle"
          onClick={() => setHeaderCollapsed(!headerCollapsed)}
        >
          <pre className="ascii-title">{`
 ╔═══════════════════════════════════════╗
 ║     R A F F L E   W I N N E R S       ║
 ╚═══════════════════════════════════════╝`}</pre>
          <span className="toggle-icon">{headerCollapsed ? '▼' : '▲'}</span>
        </div>
        {!headerCollapsed && (
          <div className="entry-form">
            ||
            <input
              ref={inputRef}
              type="text"
              value={ticketNumber}
              onChange={(e) => setTicketNumber(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ticket #"
              className="ticket-input"
            />
            <select
              value={selectedColour}
              onChange={(e) => setSelectedColour(e.target.value as RaffleColour)}
              onKeyDown={handleKeyDown}
              className="colour-select"
            >
              {COLOURS.map((colour) => (
                <option key={colour} value={colour}>
                  {colour}
                </option>
              ))}
            </select>
            <button type="button" onClick={handleAddTicket} className="add-button">
              [🖋️] Add
            </button>||
            <button type="button" onClick={() => setScannerOpen(true)} className="scan-button">
              [📷] Scan
            </button>
            ||
            <button type="button" onClick={() => setQRExportOpen(true)} className="export-button">
              [↗] Export
            </button>
            <button type="button" onClick={() => setQRImportOpen(true)} className="import-button">
              [↙] Import
            </button>
            ||
          </div>
        )}
      </div>

      <div className="winners-display">
        {tickets.length === 0 ? (
          <pre className="no-winners">{`
  ┌─────────────────────────────────┐
  │                                 │
  │     No winners yet...           │
  │                                 │
  └─────────────────────────────────┘`}</pre>
        ) : (
          <div className="colour-groups">
            {groupedTickets.map((group) => (
              <div key={group.colour} className="colour-group">
                <div className="colour-label" data-colour={group.colour.toLowerCase()}>
                  {group.colour}
                </div>
                <div className="winners-grid">
                  {group.tickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="ticket-block"
                      data-colour={ticket.colour.toLowerCase()}
                      onClick={() => handleRemoveTicket(ticket.id)}
                    >
                      <span className="ticket-number">{ticket.number}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {scannerOpen && (
        <Suspense fallback={<div className="scanner-loading">Loading scanner...</div>}>
          <Scanner
            onScanComplete={handleScanComplete}
            onClose={() => setScannerOpen(false)}
            defaultColour={selectedColour}
          />
        </Suspense>
      )}

      {qrExportOpen && (
        <Suspense fallback={<div className="scanner-loading">Loading...</div>}>
          <QRExport tickets={tickets} onClose={() => setQRExportOpen(false)} />
        </Suspense>
      )}

      {qrImportOpen && (
        <Suspense fallback={<div className="scanner-loading">Loading...</div>}>
          <QRImport onImport={handleImportTickets} onClose={() => setQRImportOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}

export default App;
