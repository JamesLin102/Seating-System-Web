import React, { useState, useRef } from 'react';
import { Camera, Upload, Download, Grid, Users, FileDown, Trash2, Shuffle } from 'lucide-react';

const ExamSeatingSystem = () => {
  const [rows, setRows] = useState(6);
  const [cols, setCols] = useState(8);
  const [disabledSeats, setDisabledSeats] = useState(new Set());
  const [students, setStudents] = useState([]);
  const [seatingArrangement, setSeatingArrangement] = useState({});
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [csvData, setCsvData] = useState(null);
  const fileInputRef = useRef(null);

  // Set classroom size
  const handleSetClassroom = () => {
    const newRows = parseInt(document.getElementById('rows-input').value);
    const newCols = parseInt(document.getElementById('cols-input').value);
    
    if (newRows < 1 || newRows > 20 || newCols < 1 || newCols > 20) {
      alert('Rows and columns must be between 1-20');
      return;
    }
    
    setRows(newRows);
    setCols(newCols);
    setDisabledSeats(new Set());
    setSeatingArrangement({});
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
    alert('Seating arrangement completed');
  };

  // Clear arrangement
  const clearArrangement = () => {
    setSeatingArrangement({});
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
          setDisabledSeats(new Set(config.disabledSeats));
          setSeatingArrangement({});
          alert('Classroom configuration loaded');
        } catch (error) {
          alert('Invalid configuration file');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  // Export to PDF
  const exportPDF = async () => {
    if (Object.keys(seatingArrangement).length === 0) {
      alert('Please arrange seats first');
      return;
    }

    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      // Find the inner seating chart content (white box with stage and seats)
      const seatingChartContent = document.querySelector('.seating-chart-content');
      
      if (!seatingChartContent) {
        alert('Cannot find seating chart element');
        return;
      }

      // Convert seating chart to canvas
      const canvas = await html2canvas(seatingChartContent, {
        scale: 3, // Higher quality
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
        windowWidth: seatingChartContent.scrollWidth,
        windowHeight: seatingChartContent.scrollHeight
      });

      const imgData = canvas.toDataURL('image/png');
      
      // A4 landscape dimensions
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      
      // Calculate dimensions to fit the page
      const imgWidth = pageWidth - 20; // 10mm margin on each side
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      const xOffset = 10;
      const yOffset = (pageHeight - imgHeight) / 2;

      doc.addImage(imgData, 'PNG', xOffset, yOffset, imgWidth, imgHeight);
      doc.save('seating_chart.pdf');
      alert('PDF exported successfully!');
    } catch (error) {
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

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Control Panel */}
      <div className="w-80 bg-white shadow-lg p-6 overflow-y-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">
          Exam Seating System
        </h1>

        {/* Classroom Settings */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Grid size={20} />
            Classroom Settings
          </h2>
          <div className="flex gap-2 mb-2">
            <div className="flex-1">
              <label className="text-sm text-gray-600">Rows (M)</label>
              <input
                id="rows-input"
                type="number"
                defaultValue={rows}
                className="w-full border rounded px-2 py-1"
                min="1"
                max="20"
              />
            </div>
            <div className="flex-1">
              <label className="text-sm text-gray-600">Cols (N)</label>
              <input
                id="cols-input"
                type="number"
                defaultValue={cols}
                className="w-full border rounded px-2 py-1"
                min="1"
                max="20"
              />
            </div>
          </div>
          <button
            onClick={handleSetClassroom}
            className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 font-medium"
          >
            Set Classroom Size
          </button>
          <p className="text-xs text-gray-500 italic mt-2 text-center">
            Click seats to enable/disable
          </p>
        </div>

        {/* Classroom Management */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">Classroom Management</h2>
          <button
            onClick={saveClassroom}
            className="w-full bg-purple-600 text-white py-2 rounded hover:bg-purple-700 mb-2 flex items-center justify-center gap-2"
          >
            <Download size={18} />
            Save Classroom
          </button>
          <button
            onClick={loadClassroom}
            className="w-full bg-purple-700 text-white py-2 rounded hover:bg-purple-800 flex items-center justify-center gap-2"
          >
            <Upload size={18} />
            Load Classroom
          </button>
        </div>

        {/* Student Information */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Users size={20} />
            Student Information
          </h2>
          <p className="text-sm text-gray-600 mb-2">
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
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 flex items-center justify-center gap-2"
          >
            📋 Load Student List
          </button>
        </div>

        {/* Seating Arrangement */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">Seating Arrangement</h2>
          <button
            onClick={arrangeSeats}
            className="w-full bg-orange-600 text-white py-2 rounded hover:bg-orange-700 mb-2 flex items-center justify-center gap-2 font-medium"
          >
            <Shuffle size={18} />
            Random Arrangement
          </button>
          <button
            onClick={clearArrangement}
            className="w-full bg-red-600 text-white py-2 rounded hover:bg-red-700 flex items-center justify-center gap-2"
          >
            <Trash2 size={18} />
            Clear Arrangement
          </button>
        </div>

        {/* Export */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">Export</h2>
          <button
            onClick={exportPDF}
            className="w-full bg-pink-600 text-white py-2 rounded hover:bg-pink-700 flex items-center justify-center gap-2 font-bold"
          >
            <FileDown size={18} />
            Export to PDF
          </button>
        </div>

        {/* Legend */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Legend</h2>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-green-200 border border-gray-400"></div>
              <span className="text-sm">Available</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-pink-200 border border-gray-400"></div>
              <span className="text-sm">Disabled</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-blue-200 border border-gray-400"></div>
              <span className="text-sm">Assigned</span>
            </div>
          </div>
        </div>
      </div>

      {/* Seating Chart */}
      <div className="flex-1 p-8">
        <div className="bg-white rounded-lg shadow-lg p-6 h-full seating-chart-content">
          {/* Stage */}
          <div className="bg-yellow-100 border-2 border-yellow-600 rounded p-4 mb-6 text-center">
            <h2 className="text-xl font-bold">STAGE</h2>
          </div>

          {/* Seats Grid */}
          <div className="flex items-center justify-center">
            <div
              className="grid gap-2"
              style={{
                gridTemplateColumns: `repeat(${cols}, minmax(60px, 80px))`,
              }}
            >
              {Array.from({ length: rows }, (_, row) =>
                Array.from({ length: cols }, (_, col) => (
                  <button
                    key={`${row}-${col}`}
                    onClick={() => toggleSeat(row, col)}
                    className={`${getSeatColor(row, col)} border-2 border-gray-400 rounded p-2 h-14 flex items-center justify-center text-xs font-medium hover:opacity-80 transition-opacity`}
                  >
                    {getSeatText(row, col)}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Column Selector Modal */}
      {showColumnSelector && csvData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-h-96 overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Select Student Name Column</h3>
            <p className="text-sm text-gray-600 mb-4">
              Please select the column containing student names:
            </p>
            <div className="space-y-2">
              {csvData.headers.map((header) => (
                <button
                  key={header}
                  onClick={() => handleColumnSelect(header)}
                  className="w-full text-left px-4 py-2 border rounded hover:bg-blue-50 hover:border-blue-500"
                >
                  {header}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowColumnSelector(false)}
              className="w-full mt-4 bg-gray-500 text-white py-2 rounded hover:bg-gray-600"
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