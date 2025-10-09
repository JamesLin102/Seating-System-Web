import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Download, Grid, Users, FileDown, Trash2, Shuffle, Menu, X, Moon, Sun } from 'lucide-react';

const ExamSeatingSystem = () => {
  const [rows, setRows] = useState(6);
  const [cols, setCols] = useState(8);
  const [rowsInput, setRowsInput] = useState('6');
  const [colsInput, setColsInput] = useState('8');
  const [disabledSeats, setDisabledSeats] = useState(new Set());
  const [students, setStudents] = useState([]);
  const [seatingArrangement, setSeatingArrangement] = useState({});
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [csvData, setCsvData] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const fileInputRef = useRef(null);

  // Initialize dark mode from localStorage
  useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode') === 'true';
    setDarkMode(savedDarkMode);
    if (savedDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  // Sync input values with state
  useEffect(() => {
    setRowsInput(String(rows));
    setColsInput(String(cols));
  }, [rows, cols]);

  // Toggle dark mode
  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    localStorage.setItem('darkMode', String(newDarkMode));
    
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    console.log('Dark mode toggled:', newDarkMode); // Debug log
  };

  // Set classroom size
  const handleSetClassroom = () => {
    const newRows = parseInt(rowsInput);
    const newCols = parseInt(colsInput);
    
    if (isNaN(newRows) || isNaN(newCols) || newRows < 1 || newRows > 20 || newCols < 1 || newCols > 20) {
      alert('Rows and columns must be between 1-20');
      return;
    }
    
    setRows(newRows);
    setCols(newCols);
    setDisabledSeats(new Set());
    setSeatingArrangement({});
    setMobileMenuOpen(false);
    alert(`Classroom size set to ${newRows} × ${newCols}`);
  };

  // Toggle seat enabled/disabled
  const toggleSeat = (row, col) => {
    const seatId = `${row},${col}`;
    
    if (seatingArrangement[seatId]) {
      alert('Please clear arrangement before modifying seats');
      return;
    }
    
    const newDisabled = new Set(disabledSeats);
    if (newDisabled.has(seatId)) {
      newDisabled.delete(seatId);
    } else {
      newDisabled.add(seatId);
    }
    setDisabledSeats(newDisabled);
  };

  // Load CSV file
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        alert('CSV file must have at least a header and one data row');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
      const data = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
        const row = {};
        headers.forEach((header, idx) => {
          row[header] = values[idx] || '';
        });
        return row;
      });

      setCsvData({ headers, data });
      setShowColumnSelector(true);
    };

    reader.readAsText(file);
    e.target.value = '';
  };

  // Select column for student names
  const handleColumnSelect = (column) => {
    if (!csvData) return;
    
    const studentList = csvData.data
      .map(row => row[column])
      .filter(name => name && name.trim() !== '');
    
    setStudents(studentList);
    setShowColumnSelector(false);
    setMobileMenuOpen(false);
    alert(`Successfully loaded ${studentList.length} students`);
  };

  // Random seat arrangement
  const arrangeSeats = () => {
    if (students.length === 0) {
      alert('Please load student list first');
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
      alert(`Number of students (${students.length}) exceeds available seats (${availableSeats.length})`);
      return;
    }

    const shuffled = [...students].sort(() => Math.random() - 0.5);
    const newArrangement = {};
    shuffled.forEach((student, idx) => {
      newArrangement[availableSeats[idx]] = student;
    });

    setSeatingArrangement(newArrangement);
    setMobileMenuOpen(false);
    alert('Seating arrangement completed');
  };

  // Clear arrangement
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
          setRows(config.rows);
          setCols(config.cols);
          setRowsInput(String(config.rows));
          setColsInput(String(config.cols));
          setDisabledSeats(new Set(config.disabledSeats));
          setSeatingArrangement({});
          setMobileMenuOpen(false);
          alert('Classroom configuration loaded');
        } catch (error) {
          alert('Invalid configuration file');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  // Export to PDF with embedded Chinese font
  const exportPDF = async () => {
    if (Object.keys(seatingArrangement).length === 0) {
      alert('Please arrange seats first');
      return;
    }

    try {
      setMobileMenuOpen(false);
      
      const { jsPDF } = await import('jspdf');
      
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      // Load Chinese font from public folder
      try {
        const fontPath = `${import.meta.env.BASE_URL}NotoSansTC-Regular.ttf`;
        const response = await fetch(fontPath);
        
        if (!response.ok) {
          throw new Error('Font file not found');
        }
        
        const fontArrayBuffer = await response.arrayBuffer();
        const fontBase64 = btoa(
          new Uint8Array(fontArrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
        
        // Add font to jsPDF
        doc.addFileToVFS('NotoSansTC-Regular.ttf', fontBase64);
        doc.addFont('NotoSansTC-Regular.ttf', 'NotoSansTC', 'normal');
        doc.setFont('NotoSansTC');
      } catch (fontError) {
        console.error('Failed to load font:', fontError);
        alert('Warning: Chinese font not loaded. PDF may not display Chinese characters correctly.');
        doc.setFont('helvetica');
      }

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Title
      doc.setFontSize(24);
      doc.text('Exam Seating Chart', pageWidth / 2, 20, { align: 'center' });

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
      alert('PDF exported successfully!');
    } catch (error) {
      console.error('Export error:', error);
      alert('Error exporting PDF: ' + error.message);
    }
  };

  // Get seat color
  const getSeatColor = (row, col) => {
    const seatId = `${row},${col}`;
    if (disabledSeats.has(seatId)) return 'bg-pink-200';
    if (seatingArrangement[seatId]) return 'bg-blue-200';
    return 'bg-green-200';
  };

  // Get seat text
  const getSeatText = (row, col) => {
    const seatId = `${row},${col}`;
    if (seatingArrangement[seatId]) return seatingArrangement[seatId];
    return `R${row+1}C${col+1}`;
  };

  // Control Panel Component
  const ControlPanel = () => (
    <div className="bg-white dark:bg-gray-800 shadow-lg p-4 md:p-6 overflow-y-auto h-full">
      <div className="flex items-center justify-between mb-4 md:mb-6">
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
          onClick={handleSetClassroom}
          className="w-full bg-green-600 dark:bg-green-700 text-white py-2 rounded hover:bg-green-700 dark:hover:bg-green-600 font-medium text-sm md:text-base"
        >
          Set Classroom Size
        </button>
        <p className="text-xs text-gray-500 dark:text-gray-400 italic mt-2 text-center">
          Click seats to enable/disable
        </p>
      </div>

      {/* Classroom Management */}
      <div className="mb-4 md:mb-6">
        <h2 className="text-base md:text-lg font-semibold mb-3 text-gray-800 dark:text-white">Classroom Management</h2>
        <button
          onClick={saveClassroom}
          className="w-full bg-purple-600 dark:bg-purple-700 text-white py-2 rounded hover:bg-purple-700 dark:hover:bg-purple-600 mb-2 flex items-center justify-center gap-2 text-sm md:text-base"
        >
          <Download size={16} />
          Save Classroom
        </button>
        <button
          onClick={loadClassroom}
          className="w-full bg-purple-700 dark:bg-purple-800 text-white py-2 rounded hover:bg-purple-800 dark:hover:bg-purple-700 flex items-center justify-center gap-2 text-sm md:text-base"
        >
          <Upload size={16} />
          Load Classroom
        </button>
      </div>

      {/* Student Information */}
      <div className="mb-4 md:mb-6">
        <h2 className="text-base md:text-lg font-semibold mb-3 flex items-center gap-2 text-gray-800 dark:text-white">
          <Users size={18} />
          Student Information
        </h2>
        <p className="text-xs md:text-sm text-gray-600 dark:text-gray-300 mb-2">
          Students Loaded: {students.length}
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
          className="w-full bg-blue-600 dark:bg-blue-700 text-white py-2 rounded hover:bg-blue-700 dark:hover:bg-blue-600 flex items-center justify-center gap-2 text-sm md:text-base"
        >
          📋 Load Student List
        </button>
      </div>

      {/* Seating Arrangement */}
      <div className="mb-4 md:mb-6">
        <h2 className="text-base md:text-lg font-semibold mb-3 text-gray-800 dark:text-white">Seating Arrangement</h2>
        <button
          onClick={arrangeSeats}
          className="w-full bg-orange-600 dark:bg-orange-700 text-white py-2 rounded hover:bg-orange-700 dark:hover:bg-orange-600 mb-2 flex items-center justify-center gap-2 font-medium text-sm md:text-base"
        >
          <Shuffle size={16} />
          Random Arrangement
        </button>
        <button
          onClick={clearArrangement}
          className="w-full bg-red-600 dark:bg-red-700 text-white py-2 rounded hover:bg-red-700 dark:hover:bg-red-600 flex items-center justify-center gap-2 text-sm md:text-base"
        >
          <Trash2 size={16} />
          Clear Arrangement
        </button>
      </div>

      {/* Export */}
      <div className="mb-4 md:mb-6">
        <h2 className="text-base md:text-lg font-semibold mb-3 text-gray-800 dark:text-white">Export</h2>
        <button
          onClick={exportPDF}
          className="w-full bg-pink-600 dark:bg-pink-700 text-white py-2 rounded hover:bg-pink-700 dark:hover:bg-pink-600 flex items-center justify-center gap-2 font-bold text-sm md:text-base"
        >
          <FileDown size={16} />
          Export to PDF
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

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col md:flex-row">
      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="md:hidden fixed top-4 left-4 z-50 bg-blue-600 dark:bg-blue-700 text-white p-3 rounded-lg shadow-lg hover:bg-blue-700 dark:hover:bg-blue-600"
      >
        {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Control Panel - Desktop */}
      <div className="hidden md:block md:w-80 lg:w-96">
        <ControlPanel />
      </div>

      {/* Control Panel - Mobile (Overlay) */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black bg-opacity-50" onClick={() => setMobileMenuOpen(false)}>
          <div 
            className="absolute left-0 top-0 bottom-0 w-80 max-w-[85vw] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <ControlPanel />
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
          <div className="flex items-center justify-center overflow-x-auto">
            <div
              className="grid gap-1 md:gap-2"
              style={{
                gridTemplateColumns: `repeat(${cols}, minmax(60px, 80px))`,
              }}
            >
              {Array.from({ length: rows }, (_, row) =>
                Array.from({ length: cols }, (_, col) => (
                  <button
                    key={`${row}-${col}`}
                    onClick={() => toggleSeat(row, col)}
                    className={`${getSeatColor(row, col)} ${
                      getSeatColor(row, col) === 'bg-green-200' ? 'dark:bg-green-700' :
                      getSeatColor(row, col) === 'bg-pink-200' ? 'dark:bg-pink-700' :
                      'dark:bg-blue-700'
                    } border-2 border-gray-400 dark:border-gray-500 rounded px-1 py-2 md:px-2 md:py-3 min-h-[50px] md:min-h-[60px] flex items-center justify-center text-xs md:text-sm font-medium hover:opacity-80 transition-opacity text-gray-900 dark:text-white leading-tight`}
                  >
                    <span className="text-center w-full leading-tight whitespace-nowrap overflow-hidden text-ellipsis">
                      {getSeatText(row, col)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Column Selector Modal */}
      {showColumnSelector && csvData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 md:p-6 w-full max-w-md max-h-96 overflow-y-auto">
            <h3 className="text-lg md:text-xl font-bold mb-4 text-gray-900 dark:text-white">Select Student Name Column</h3>
            <p className="text-xs md:text-sm text-gray-600 dark:text-gray-300 mb-4">
              Please select the column containing student names:
            </p>
            <div className="space-y-2">
              {csvData.headers.map((header) => (
                <button
                  key={header}
                  onClick={() => handleColumnSelect(header)}
                  className="w-full text-left px-3 md:px-4 py-2 border dark:border-gray-600 rounded hover:bg-blue-50 dark:hover:bg-blue-900 hover:border-blue-500 dark:hover:border-blue-400 text-sm md:text-base text-gray-900 dark:text-white"
                >
                  {header}
                </button>
              ))}
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
    </div>
  );
};

export default ExamSeatingSystem;