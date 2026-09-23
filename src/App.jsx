import React, { useState, useRef, useEffect } from 'react';
import {
  Upload, Download, Grid, Users, FileDown, Trash2, Shuffle, Menu, X, Moon, Sun,
  Grid3x3, RotateCcw, Loader2, AlertCircle, CheckCircle2, Info
} from 'lucide-react';

const DEFAULT_PDF_TITLE = 'Exam Seating Chart';

// Decode file bytes: try UTF-8 first, fall back to Big5 (common for Excel CSVs in Taiwan)
const decodeText = (buffer) => {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('big5').decode(buffer);
  }
};

// Minimal CSV parser that handles quoted fields, escaped quotes and CRLF
const parseCSV = (text) => {
  const result = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field.trim());
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field.trim());
      result.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  row.push(field.trim());
  result.push(row);

  return result.filter(r => r.some(v => v !== ''));
};

// Fisher-Yates shuffle (unbiased, unlike sort(() => Math.random() - 0.5))
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const ExamSeatingSystem = () => {
  const [rows, setRows] = useState(6);
  const [cols, setCols] = useState(8);
  const [rowsInput, setRowsInput] = useState('6');
  const [colsInput, setColsInput] = useState('8');
  const [disabledSeats, setDisabledSeats] = useState(new Set());
  const [students, setStudents] = useState([]);
  const [studentFileName, setStudentFileName] = useState('');
  const [seatingArrangement, setSeatingArrangement] = useState({});
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [csvData, setCsvData] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) return saved === 'true';
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  });
  const [checkerPattern, setCheckerPattern] = useState(null); // null | 0 (R1C1 seated) | 1 (R1C1 empty)
  const [showTitleDialog, setShowTitleDialog] = useState(false);
  const [pdfTitle, setPdfTitle] = useState(DEFAULT_PDF_TITLE);
  const [titleInput, setTitleInput] = useState('');
  const [exporting, setExporting] = useState(false);
  const [toasts, setToasts] = useState([]);
  const fileInputRef = useRef(null);
  const fontCacheRef = useRef(null);
  const paintRef = useRef(null); // { start, disabled, snapshot } while drag-selecting seats
  const pointerTypeRef = useRef(null);

  const hasArrangement = Object.keys(seatingArrangement).length > 0;
  const availableSeatCount = rows * cols - disabledSeats.size;
  const notEnoughSeats = students.length > availableSeatCount;

  // Apply dark mode class
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  // Sync input values with state
  useEffect(() => {
    setRowsInput(String(rows));
    setColsInput(String(cols));
  }, [rows, cols]);

  // Stop drag-painting when the mouse is released anywhere
  useEffect(() => {
    const stopPaint = () => { paintRef.current = null; };
    window.addEventListener('pointerup', stopPaint);
    return () => window.removeEventListener('pointerup', stopPaint);
  }, []);

  // Close modals with Escape
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      setShowColumnSelector(false);
      setShowTitleDialog(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Show a non-blocking notification
  const notify = (message, type = 'error') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, type === 'error' ? 5000 : 3000);
  };

  const dismissToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Toggle dark mode
  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    localStorage.setItem('darkMode', String(newDarkMode));
  };

  // Set classroom size (keeps disabled seats that still fit)
  const handleSetClassroom = () => {
    const newRows = parseInt(rowsInput);
    const newCols = parseInt(colsInput);

    if (isNaN(newRows) || isNaN(newCols) || newRows < 1 || newRows > 20 || newCols < 1 || newCols > 20) {
      notify('Rows and columns must be between 1-20');
      return;
    }

    const kept = new Set(
      Array.from(disabledSeats).filter(seatId => {
        const [r, c] = seatId.split(',').map(Number);
        return r < newRows && c < newCols;
      })
    );

    setRows(newRows);
    setCols(newCols);
    setDisabledSeats(kept);
    setSeatingArrangement({});
    setCheckerPattern(null);
    setMobileMenuOpen(false);
  };

  // Set a single seat's disabled state
  const setSeatDisabled = (seatId, disabled) => {
    setDisabledSeats(prev => {
      if (prev.has(seatId) === disabled) return prev;
      const next = new Set(prev);
      if (disabled) next.add(seatId);
      else next.delete(seatId);
      return next;
    });
  };

  // Toggle seat enabled/disabled
  const toggleSeat = (seatId) => {
    if (seatingArrangement[seatId]) {
      notify('This seat is assigned. Clear assigned students before disabling it.');
      return false;
    }
    setSeatDisabled(seatId, !disabledSeats.has(seatId));
    return true;
  };

  // Mouse: press and drag to enable/disable every seat in the rectangle
  // between the starting seat and the current seat
  const handleSeatPointerDown = (e, seatId) => {
    pointerTypeRef.current = e.pointerType;
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    e.preventDefault();
    if (toggleSeat(seatId)) {
      paintRef.current = {
        start: seatId.split(',').map(Number),
        disabled: !disabledSeats.has(seatId),
        snapshot: disabledSeats,
      };
    }
  };

  const handleSeatPointerEnter = (seatId) => {
    const paint = paintRef.current;
    if (!paint) return;

    const [r1, c1] = paint.start;
    const [r2, c2] = seatId.split(',').map(Number);
    const next = new Set(paint.snapshot);
    for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) {
      for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) {
        const id = `${r},${c}`;
        if (seatingArrangement[id]) continue;
        if (paint.disabled) next.add(id);
        else next.delete(id);
      }
    }
    setDisabledSeats(next);
  };

  // Touch and keyboard use a normal click (mouse is handled on pointer down)
  const handleSeatClick = (seatId) => {
    if (pointerTypeRef.current === 'mouse') {
      pointerTypeRef.current = null;
      return;
    }
    pointerTypeRef.current = null;
    toggleSeat(seatId);
  };

  // Enable every seat
  const enableAllSeats = () => {
    setDisabledSeats(new Set());
    setCheckerPattern(null);
  };

  // Apply checkerboard pattern; each click switches between the two patterns
  const applyCheckerboard = () => {
    if (hasArrangement) {
      notify('Clear assigned students before changing the seat layout');
      return;
    }

    const pattern = checkerPattern === 0 ? 1 : 0;
    const newDisabled = new Set();
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if ((row + col) % 2 !== pattern) {
          newDisabled.add(`${row},${col}`);
        }
      }
    }
    setDisabledSeats(newDisabled);
    setCheckerPattern(pattern);
  };

  // Load CSV file
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const lines = parseCSV(decodeText(event.target.result));

      if (lines.length < 2) {
        notify('CSV file must have at least a header and one data row');
        return;
      }

      const headers = lines[0].map((h, idx) => h || `Column ${idx + 1}`);
      const data = lines.slice(1).map(values => {
        const row = {};
        headers.forEach((header, idx) => {
          row[header] = values[idx] || '';
        });
        return row;
      });

      // Only one column: no need to ask
      if (headers.length === 1) {
        applyStudentColumn(data, headers[0], file.name);
        return;
      }

      setCsvData({ headers, data, fileName: file.name });
      setShowColumnSelector(true);
    };

    reader.onerror = () => notify('Failed to read file');
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const applyStudentColumn = (data, column, fileName) => {
    const studentList = data
      .map(row => row[column])
      .filter(name => name && name.trim() !== '');

    if (studentList.length === 0) {
      notify(`Column "${column}" has no names`);
      return;
    }

    setStudents(studentList);
    setStudentFileName(fileName);
    setSeatingArrangement({});
    setShowColumnSelector(false);
    setMobileMenuOpen(false);
  };

  // Select column for student names
  const handleColumnSelect = (column) => {
    if (!csvData) return;
    applyStudentColumn(csvData.data, column, csvData.fileName);
  };

  // Random seat arrangement
  const arrangeSeats = () => {
    if (students.length === 0) {
      notify('Please load a student list first');
      return;
    }

    const availableSeats = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const seatId = `${row},${col}`;
        if (!disabledSeats.has(seatId)) {
          availableSeats.push(seatId);
        }
      }
    }

    if (students.length > availableSeats.length) {
      notify(`Not enough seats: ${students.length} students but only ${availableSeats.length} available seats`);
      return;
    }

    const shuffled = shuffle(students);
    const newArrangement = {};
    shuffled.forEach((student, idx) => {
      newArrangement[availableSeats[idx]] = student;
    });

    setSeatingArrangement(newArrangement);
    setMobileMenuOpen(false);
  };

  // Remove assigned students from seats (seat layout is kept)
  const clearArrangement = () => {
    setSeatingArrangement({});
    setMobileMenuOpen(false);
  };

  // Save classroom configuration
  const saveClassroom = () => {
    const config = {
      rows,
      cols,
      disabledSeats: Array.from(disabledSeats)
    };

    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'classroom_config.json';
    a.click();
    URL.revokeObjectURL(url);
    setMobileMenuOpen(false);
  };

  // Load classroom configuration
  const loadClassroom = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const config = JSON.parse(event.target.result);
          const valid =
            Number.isInteger(config.rows) && config.rows >= 1 && config.rows <= 20 &&
            Number.isInteger(config.cols) && config.cols >= 1 && config.cols <= 20 &&
            Array.isArray(config.disabledSeats);
          if (!valid) throw new Error('Invalid config');

          setRows(config.rows);
          setCols(config.cols);
          setRowsInput(String(config.rows));
          setColsInput(String(config.cols));
          setDisabledSeats(new Set(config.disabledSeats));
          setSeatingArrangement({});
          setCheckerPattern(null);
          setMobileMenuOpen(false);
        } catch {
          notify('Invalid configuration file');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  // Open title dialog before exporting
  const openExportDialog = () => {
    if (!hasArrangement) {
      notify('Please arrange seats first');
      return;
    }
    setMobileMenuOpen(false);
    setTitleInput(pdfTitle);
    setShowTitleDialog(true);
  };

  const confirmExport = () => {
    const title = titleInput.trim() || DEFAULT_PDF_TITLE;
    setPdfTitle(title);
    setShowTitleDialog(false);
    exportPDF(title);
  };

  // Load Chinese font once and cache it
  const loadFontBase64 = async () => {
    if (fontCacheRef.current) return fontCacheRef.current;

    const response = await fetch(`${import.meta.env.BASE_URL}NotoSansTC-Regular.ttf`);
    if (!response.ok) {
      throw new Error('Font file not found');
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    fontCacheRef.current = btoa(binary);
    return fontCacheRef.current;
  };

  // Export to PDF with embedded Chinese font
  const exportPDF = async (title) => {
    setExporting(true);
    try {
      const { jsPDF } = await import('jspdf');

      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      try {
        const fontBase64 = await loadFontBase64();
        doc.addFileToVFS('NotoSansTC-Regular.ttf', fontBase64);
        doc.addFont('NotoSansTC-Regular.ttf', 'NotoSansTC', 'normal');
        doc.setFont('NotoSansTC');
      } catch (fontError) {
        console.error('Failed to load font:', fontError);
        notify('Chinese font not loaded. Chinese characters may not display correctly.', 'warning');
        doc.setFont('helvetica');
      }

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Title (shrink font if too long to fit on one line)
      let titleFontSize = 24;
      doc.setFontSize(titleFontSize);
      while (titleFontSize > 10 && doc.getTextWidth(title) > pageWidth - 40) {
        titleFontSize -= 1;
        doc.setFontSize(titleFontSize);
      }
      doc.text(title, pageWidth / 2, 20, { align: 'center' });

      // Stage
      const stageY = 35;
      const stageHeight = 15;
      doc.setFillColor(210, 180, 140); // Tan - light brown
      doc.rect(20, stageY, pageWidth - 40, stageHeight, 'F');
      doc.setDrawColor(0);
      doc.setLineWidth(0.5);
      doc.rect(20, stageY, pageWidth - 40, stageHeight, 'S');
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text('STAGE', pageWidth / 2, stageY + 10, { align: 'center' });

      // Calculate seat dimensions
      const margin = 20;
      const startY = stageY + stageHeight + 15;
      const availableWidth = pageWidth - (margin * 2);
      const availableHeight = pageHeight - startY - margin;

      const seatWidth = Math.min(availableWidth / cols, 35);
      const seatHeight = Math.min(availableHeight / rows, 25);

      const gridWidth = seatWidth * cols;
      const startX = (pageWidth - gridWidth) / 2;

      // Draw seats
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const seatId = `${row},${col}`;

          if (disabledSeats.has(seatId)) {
            continue;
          }

          const x = startX + col * seatWidth;
          const y = startY + row * seatHeight;

          // Determine color
          if (seatingArrangement[seatId]) {
            doc.setFillColor(135, 206, 235); // Blue
          } else {
            doc.setFillColor(144, 238, 144); // Green
          }

          // Draw rectangle with border
          doc.setLineWidth(0.3);
          doc.setDrawColor(100, 100, 100);
          doc.rect(x, y, seatWidth - 1, seatHeight - 1, 'FD');

          // Draw text - properly centered
          const text = seatingArrangement[seatId] || `R${row + 1}C${col + 1}`;

          // Calculate text position for proper centering
          const textX = x + (seatWidth - 1) / 2;
          const textY = y + (seatHeight - 1) / 2 + 1.5; // Adjusted for better vertical centering

          doc.text(text, textX, textY, {
            align: 'center',
            baseline: 'middle',
            maxWidth: seatWidth - 4
          });
        }
      }

      // Add footer
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      const date = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      doc.text(`Generated: ${date}`, pageWidth - 15, pageHeight - 5, { align: 'right' });

      doc.save('seating_chart.pdf');
    } catch (error) {
      console.error('Export error:', error);
      notify('Error exporting PDF: ' + error.message);
    } finally {
      setExporting(false);
    }
  };

  // Get seat color classes
  const getSeatClasses = (seatId) => {
    if (disabledSeats.has(seatId)) return 'bg-pink-200 dark:bg-pink-700';
    if (seatingArrangement[seatId]) return 'bg-blue-200 dark:bg-blue-700';
    return 'bg-green-200 dark:bg-green-700';
  };

  // Get seat text
  const getSeatText = (row, col) => {
    const seatId = `${row},${col}`;
    if (seatingArrangement[seatId]) return seatingArrangement[seatId];
    return `R${row + 1}C${col + 1}`;
  };

  const btnBase = 'w-full text-white py-2 rounded flex items-center justify-center gap-2 text-sm md:text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

  // Control panel content. Rendered by calling the function (not as <Component />)
  // so inputs are not remounted on every render and keep focus while typing.
  const renderControlPanel = (isMobile = false) => (
    <div className="bg-white dark:bg-gray-800 shadow-lg p-4 md:p-6 overflow-y-auto h-full">
      <div className="flex items-center justify-between gap-2 mb-4 md:mb-6">
        {isMobile && (
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200"
            title="Close menu"
          >
            <X size={20} />
          </button>
        )}
        <h1 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white text-center flex-1">
          Exam Seating System
        </h1>
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {darkMode ? <Sun size={20} className="text-yellow-400" /> : <Moon size={20} className="text-gray-700" />}
        </button>
      </div>

      {/* Classroom Settings */}
      <div className="mb-4 md:mb-6">
        <h2 className="text-base md:text-lg font-semibold mb-3 flex items-center gap-2 text-gray-800 dark:text-white">
          <Grid size={18} />
          Classroom Settings
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSetClassroom();
          }}
        >
          <div className="flex gap-2 mb-2">
            <div className="flex-1">
              <label className="text-xs md:text-sm text-gray-600 dark:text-gray-300">Rows (M)</label>
              <input
                type="number"
                value={rowsInput}
                onChange={(e) => setRowsInput(e.target.value)}
                className="w-full border dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                min="1"
                max="20"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs md:text-sm text-gray-600 dark:text-gray-300">Cols (N)</label>
              <input
                type="number"
                value={colsInput}
                onChange={(e) => setColsInput(e.target.value)}
                className="w-full border dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                min="1"
                max="20"
              />
            </div>
          </div>
          <button
            type="submit"
            className={`${btnBase} bg-green-600 dark:bg-green-700 hover:bg-green-700 dark:hover:bg-green-600 font-medium`}
          >
            Set Classroom Size
          </button>
        </form>
      </div>

      {/* Classroom Management */}
      <div className="mb-4 md:mb-6">
        <h2 className="text-base md:text-lg font-semibold mb-3 text-gray-800 dark:text-white">Classroom Management</h2>
        <div className="flex gap-2">
          <button
            onClick={saveClassroom}
            className={`${btnBase} bg-purple-600 dark:bg-purple-700 hover:bg-purple-700 dark:hover:bg-purple-600`}
          >
            <Download size={16} />
            Save
          </button>
          <button
            onClick={loadClassroom}
            className={`${btnBase} bg-purple-700 dark:bg-purple-800 hover:bg-purple-800 dark:hover:bg-purple-700`}
          >
            <Upload size={16} />
            Load
          </button>
        </div>
      </div>

      {/* Student Information */}
      <div className="mb-4 md:mb-6">
        <h2 className="text-base md:text-lg font-semibold mb-3 flex items-center gap-2 text-gray-800 dark:text-white">
          <Users size={18} />
          Student Information
        </h2>
        <p className="text-xs md:text-sm text-gray-600 dark:text-gray-300 mb-2 truncate" title={studentFileName}>
          Students Loaded: <span className="font-semibold">{students.length}</span>
          {studentFileName && <span className="text-gray-400 dark:text-gray-500"> ({studentFileName})</span>}
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className={`${btnBase} bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-600`}
        >
          📋 {students.length > 0 ? 'Replace Student List' : 'Load Student List'}
        </button>
      </div>

      {/* Seating Arrangement */}
      <div className="mb-4 md:mb-6">
        <h2 className="text-base md:text-lg font-semibold mb-3 text-gray-800 dark:text-white">Seating Arrangement</h2>

        <div
          className={`text-xs md:text-sm mb-3 px-3 py-2 rounded border ${
            notEnoughSeats
              ? 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300'
              : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300'
          }`}
        >
          Available seats: <span className="font-semibold">{availableSeatCount}</span>
          <span className="mx-2">·</span>
          Students: <span className="font-semibold">{students.length}</span>
          {notEnoughSeats && (
            <div className="mt-1">Need {students.length - availableSeatCount} more seat(s)</div>
          )}
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          Seat layout — click a seat to enable/disable, or drag to toggle a block of seats
        </p>
        <div className="flex gap-2 mb-3">
          <button
            onClick={applyCheckerboard}
            disabled={hasArrangement}
            className={`${btnBase} bg-teal-600 dark:bg-teal-700 hover:bg-teal-700 dark:hover:bg-teal-600 font-medium`}
            title={hasArrangement ? 'Clear assigned students first' : 'Click again to switch between the two patterns'}
          >
            <Grid3x3 size={16} />
            Checkerboard{checkerPattern !== null && ` (${checkerPattern === 0 ? 'A' : 'B'})`}
          </button>
          <button
            onClick={enableAllSeats}
            disabled={disabledSeats.size === 0}
            className={`${btnBase} bg-gray-600 dark:bg-gray-600 hover:bg-gray-700 dark:hover:bg-gray-500`}
            title="Enable all seats"
          >
            <RotateCcw size={16} />
            Enable All
          </button>
        </div>

        <button
          onClick={arrangeSeats}
          disabled={students.length === 0}
          className={`${btnBase} bg-orange-600 dark:bg-orange-700 hover:bg-orange-700 dark:hover:bg-orange-600 mb-2 font-medium`}
          title={students.length === 0 ? 'Load a student list first' : undefined}
        >
          <Shuffle size={16} />
          {hasArrangement ? 'Shuffle Again' : 'Random Arrangement'}
        </button>
        <button
          onClick={clearArrangement}
          disabled={!hasArrangement}
          className={`${btnBase} bg-red-600 dark:bg-red-700 hover:bg-red-700 dark:hover:bg-red-600`}
          title="Remove students from seats (seat layout is kept)"
        >
          <Trash2 size={16} />
          Clear Assigned Students
        </button>
        {students.length === 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400 italic mt-2 text-center">
            Load a student list to arrange seats
          </p>
        )}
      </div>

      {/* Export */}
      <div className="mb-4 md:mb-6">
        <h2 className="text-base md:text-lg font-semibold mb-3 text-gray-800 dark:text-white">Export</h2>
        <button
          onClick={openExportDialog}
          disabled={!hasArrangement || exporting}
          className={`${btnBase} bg-pink-600 dark:bg-pink-700 hover:bg-pink-700 dark:hover:bg-pink-600 font-bold`}
          title={!hasArrangement ? 'Arrange seats first' : undefined}
        >
          {exporting ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
          {exporting ? 'Exporting...' : 'Export to PDF'}
        </button>
      </div>

      {/* Legend */}
      <div>
        <h2 className="text-base md:text-lg font-semibold mb-3 text-gray-800 dark:text-white">Legend</h2>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 md:w-6 md:h-6 bg-green-200 dark:bg-green-700 border border-gray-400 dark:border-gray-500"></div>
            <span className="text-xs md:text-sm text-gray-800 dark:text-gray-200">Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 md:w-6 md:h-6 bg-pink-200 dark:bg-pink-700 border border-gray-400 dark:border-gray-500"></div>
            <span className="text-xs md:text-sm text-gray-800 dark:text-gray-200">Disabled</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 md:w-6 md:h-6 bg-blue-200 dark:bg-blue-700 border border-gray-400 dark:border-gray-500"></div>
            <span className="text-xs md:text-sm text-gray-800 dark:text-gray-200">Assigned</span>
          </div>
        </div>
      </div>
    </div>
  );

  const toastStyles = {
    error: { cls: 'bg-red-600', Icon: AlertCircle },
    warning: { cls: 'bg-amber-600', Icon: Info },
    success: { cls: 'bg-green-600', Icon: CheckCircle2 },
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col md:flex-row">
      {/* Mobile Menu Button */}
      {!mobileMenuOpen && (
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="md:hidden fixed top-4 left-4 z-30 bg-blue-600 dark:bg-blue-700 text-white p-3 rounded-lg shadow-lg hover:bg-blue-700 dark:hover:bg-blue-600"
          title="Open menu"
        >
          <Menu size={24} />
        </button>
      )}

      {/* Control Panel - Desktop */}
      <div className="hidden md:block md:w-80 lg:w-96 md:h-screen md:sticky md:top-0">
        {renderControlPanel()}
      </div>

      {/* Control Panel - Mobile (Overlay) */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black bg-opacity-50" onClick={() => setMobileMenuOpen(false)}>
          <div
            className="absolute left-0 top-0 bottom-0 w-80 max-w-[85vw] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {renderControlPanel(true)}
          </div>
        </div>
      )}

      {/* Seating Chart */}
      <div className="flex-1 p-4 md:p-8 pt-20 md:pt-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 md:p-6 h-full seating-chart-content">
          {/* Stage */}
          <div className="bg-yellow-100 dark:bg-yellow-900 border-2 border-yellow-600 dark:border-yellow-700 rounded p-2 md:p-4 mb-4 md:mb-6 text-center">
            <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">STAGE</h2>
          </div>

          {/* Seats Grid */}
          <div className="overflow-x-auto">
            <div
              className="grid gap-1 md:gap-2 select-none w-max mx-auto"
              style={{
                gridTemplateColumns: `repeat(${cols}, minmax(60px, 80px))`,
              }}
            >
              {Array.from({ length: rows }, (_, row) =>
                Array.from({ length: cols }, (_, col) => {
                  const seatId = `${row},${col}`;
                  const text = getSeatText(row, col);
                  return (
                    <button
                      key={seatId}
                      onPointerDown={(e) => handleSeatPointerDown(e, seatId)}
                      onPointerEnter={() => handleSeatPointerEnter(seatId)}
                      onClick={() => handleSeatClick(seatId)}
                      title={text}
                      className={`${getSeatClasses(seatId)} border-2 border-gray-400 dark:border-gray-500 rounded px-1 py-2 md:px-2 md:py-3 min-h-[50px] md:min-h-[60px] flex items-center justify-center text-xs md:text-sm font-medium hover:opacity-80 transition-opacity text-gray-900 dark:text-white leading-tight`}
                    >
                      <span className="text-center w-full leading-tight whitespace-nowrap overflow-hidden text-ellipsis">
                        {text}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* PDF Title Modal */}
      {showTitleDialog && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowTitleDialog(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg p-4 md:p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg md:text-xl font-bold mb-4 text-gray-900 dark:text-white">PDF Title</h3>
            <input
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return;
                if (e.key === 'Enter') confirmExport();
              }}
              onFocus={(e) => e.target.select()}
              placeholder={DEFAULT_PDF_TITLE}
              autoFocus
              className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm md:text-base bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowTitleDialog(false)}
                className="flex-1 bg-gray-500 dark:bg-gray-600 text-white py-2 rounded hover:bg-gray-600 dark:hover:bg-gray-500 text-sm md:text-base"
              >
                Cancel
              </button>
              <button
                onClick={confirmExport}
                className="flex-1 bg-pink-600 dark:bg-pink-700 text-white py-2 rounded hover:bg-pink-700 dark:hover:bg-pink-600 font-bold text-sm md:text-base"
              >
                Export
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Column Selector Modal */}
      {showColumnSelector && csvData && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowColumnSelector(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg p-4 md:p-6 w-full max-w-md max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg md:text-xl font-bold mb-4 text-gray-900 dark:text-white">Select Student Name Column</h3>
            <p className="text-xs md:text-sm text-gray-600 dark:text-gray-300 mb-4">
              Please select the column containing student names:
            </p>
            <div className="space-y-2">
              {csvData.headers.map((header) => {
                const samples = csvData.data.map(row => row[header]).filter(Boolean).slice(0, 3);
                return (
                  <button
                    key={header}
                    onClick={() => handleColumnSelect(header)}
                    className="w-full text-left px-3 md:px-4 py-2 border dark:border-gray-600 rounded hover:bg-blue-50 dark:hover:bg-blue-900 hover:border-blue-500 dark:hover:border-blue-400 text-gray-900 dark:text-white"
                  >
                    <div className="text-sm md:text-base font-medium">{header}</div>
                    {samples.length > 0 && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        e.g. {samples.join(', ')}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setShowColumnSelector(false)}
              className="w-full mt-4 bg-gray-500 dark:bg-gray-600 text-white py-2 rounded hover:bg-gray-600 dark:hover:bg-gray-500 text-sm md:text-base"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-md pointer-events-none">
        {toasts.map(({ id, message, type }) => {
          const { cls, Icon } = toastStyles[type] || toastStyles.error;
          return (
            <div
              key={id}
              className={`${cls} text-white rounded-lg shadow-lg px-4 py-3 flex items-start gap-2 text-sm pointer-events-auto`}
              role="alert"
            >
              <Icon size={18} className="shrink-0 mt-0.5" />
              <span className="flex-1">{message}</span>
              <button onClick={() => dismissToast(id)} className="shrink-0 opacity-80 hover:opacity-100">
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ExamSeatingSystem;
