import React, { useState, useRef, useCallback } from 'react';
import { Plus, Minus, RotateCcw } from 'lucide-react';

const CabinetVisualizer = () => {
  const [cabinet, setCabinet] = useState({
    width: 800,
    height: 600,
    shelves: [
      { id: 1, height: 120, partitions: [{ id: 1, width: 400 }, { id: 2, width: 400 }] },
      { id: 2, height: 120, partitions: [{ id: 3, width: 266 }, { id: 4, width: 266 }, { id: 5, width: 268 }] },
      { id: 3, height: 120, partitions: [{ id: 6, width: 800 }] }
    ]
  });
  
  const [dragging, setDragging] = useState(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const svgRef = useRef(null);
  const [hoveredElement, setHoveredElement] = useState(null);
  const [selectedPartition, setSelectedPartition] = useState(null);
  const [partitionDragging, setPartitionDragging] = useState(null);
  const partitionSvgRef = useRef(null);

  const scale = Math.min(1, 600 / cabinet.width);
  const SLAT_WIDTH = 12; // 1/2 inch in pixels (assuming 24px = 1 inch)

  const getSVGCoordinates = (e) => {
    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / scale,
      y: (e.clientY - rect.top) / scale
    };
  };

  const getPartitionSVGCoordinates = (e) => {
    const svg = partitionSvgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const partitionScale = Math.min(1, 400 / (selectedPartition?.width || 400));
    return {
      x: (e.clientX - rect.left) / partitionScale,
      y: (e.clientY - rect.top) / partitionScale
    };
  };

  const findPartitionById = (partitionId) => {
    for (const shelf of cabinet.shelves) {
      const partition = shelf.partitions.find(p => p.id === partitionId);
      if (partition) {
        return { partition, shelfId: shelf.id };
      }
    }
    return null;
  };

  const handleMouseDown = (e, type, data) => {
    e.preventDefault();
    if (type === 'partition-subdivision') {
      const coords = getPartitionSVGCoordinates(e);
      setDragStart(coords);
      setPartitionDragging({ type, ...data });
    } else {
      const coords = getSVGCoordinates(e);
      setDragStart(coords);
      setDragging({ type, ...data });
    }
  };

  const handleMouseMove = useCallback((e) => {
    if (!dragging && !partitionDragging) return;
    
    if (partitionDragging) {
      const coords = getPartitionSVGCoordinates(e);
      const deltaX = coords.x - dragStart.x;
      
      if (partitionDragging.type === 'partition-subdivision') {
        const { subdivisionIndex } = partitionDragging;
        const partitionData = findPartitionById(selectedPartition.id);
        
        if (partitionData) {
          setCabinet(prev => ({
            ...prev,
            shelves: prev.shelves.map(shelf => {
              if (shelf.id === partitionData.shelfId) {
                return {
                  ...shelf,
                  partitions: shelf.partitions.map(partition => {
                    if (partition.id === selectedPartition.id) {
                      const subdivisions = partition.subdivisions || [];
                      const newSubdivisions = [...subdivisions];
                      
                      if (subdivisionIndex < newSubdivisions.length - 1) {
                        const newWidth = Math.max(SLAT_WIDTH, newSubdivisions[subdivisionIndex] + deltaX);
                        const maxWidth = partition.width - (newSubdivisions.length - 1) * SLAT_WIDTH;
                        const currentTotal = newSubdivisions.reduce((sum, w, i) => i === subdivisionIndex ? sum : sum + w, 0);
                        const availableWidth = maxWidth - currentTotal;
                        
                        if (newWidth <= availableWidth) {
                          const widthDiff = newWidth - newSubdivisions[subdivisionIndex];
                          if (newSubdivisions[subdivisionIndex + 1] - widthDiff >= SLAT_WIDTH) {
                            newSubdivisions[subdivisionIndex] = newWidth;
                            newSubdivisions[subdivisionIndex + 1] -= widthDiff;
                          }
                        }
                      }
                      
                      return { ...partition, subdivisions: newSubdivisions };
                    }
                    return partition;
                  })
                };
              }
              return shelf;
            })
          }));
        }
      }
      return;
    }
    
    const coords = getSVGCoordinates(e);
    const deltaX = coords.x - dragStart.x;
    const deltaY = coords.y - dragStart.y;

    if (dragging.type === 'partition') {
      // Resize partition by dragging its right edge
      const { shelfId, partitionId } = dragging;
      setCabinet(prev => ({
        ...prev,
        shelves: prev.shelves.map(shelf => {
          if (shelf.id === shelfId) {
            const partitionIndex = shelf.partitions.findIndex(p => p.id === partitionId);
            if (partitionIndex < shelf.partitions.length - 1) {
              const newPartitions = [...shelf.partitions];
              const newWidth = Math.max(50, Math.min(cabinet.width - 100, newPartitions[partitionIndex].width + deltaX));
              const widthDiff = newWidth - newPartitions[partitionIndex].width;
              
              if (newPartitions[partitionIndex + 1].width - widthDiff >= 50) {
                newPartitions[partitionIndex] = { ...newPartitions[partitionIndex], width: newWidth };
                newPartitions[partitionIndex + 1] = { 
                  ...newPartitions[partitionIndex + 1], 
                  width: newPartitions[partitionIndex + 1].width - widthDiff 
                };
                return { ...shelf, partitions: newPartitions };
              }
            }
          }
          return shelf;
        })
      }));
    } else if (dragging.type === 'shelf') {
      // Resize shelf height by dragging its bottom edge
      const { shelfId } = dragging;
      setCabinet(prev => ({
        ...prev,
        shelves: prev.shelves.map(shelf =>
          shelf.id === shelfId 
            ? { ...shelf, height: Math.max(50, Math.min(200, shelf.height + deltaY)) }
            : shelf
        )
      }));
    }
  }, [dragging, partitionDragging, dragStart, cabinet.width, selectedPartition, findPartitionById, SLAT_WIDTH]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
    setPartitionDragging(null);
  }, []);

  // Attach global mouse events
  React.useEffect(() => {
    if (dragging || partitionDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, partitionDragging, handleMouseMove, handleMouseUp]);

  const addShelf = () => {
    const newShelf = {
      id: Date.now(),
      height: 120,
      partitions: [{ id: Date.now() + 1, width: cabinet.width }]
    };
    setCabinet(prev => ({
      ...prev,
      shelves: [...prev.shelves, newShelf]
    }));
  };

  const removeShelf = (shelfId) => {
    setCabinet(prev => ({
      ...prev,
      shelves: prev.shelves.filter(shelf => shelf.id !== shelfId)
    }));
  };

  const addPartition = (shelfId, clickX) => {
    setCabinet(prev => ({
      ...prev,
      shelves: prev.shelves.map(shelf => {
        if (shelf.id === shelfId) {
          // Find which partition was clicked
          let currentX = 0;
          let targetPartitionIndex = 0;
          
          for (let i = 0; i < shelf.partitions.length; i++) {
            if (clickX >= currentX && clickX < currentX + shelf.partitions[i].width) {
              targetPartitionIndex = i;
              break;
            }
            currentX += shelf.partitions[i].width;
          }
          
          // Split the partition at the click point
          const targetPartition = shelf.partitions[targetPartitionIndex];
          const relativeX = clickX - shelf.partitions.slice(0, targetPartitionIndex).reduce((sum, p) => sum + p.width, 0);
          const leftWidth = Math.max(50, relativeX);
          const rightWidth = Math.max(50, targetPartition.width - leftWidth);
          
          const newPartitions = [...shelf.partitions];
          newPartitions[targetPartitionIndex] = { ...targetPartition, width: leftWidth };
          newPartitions.splice(targetPartitionIndex + 1, 0, { id: Date.now(), width: rightWidth });
          
          return { ...shelf, partitions: newPartitions };
        }
        return shelf;
      })
    }));
  };

  const removePartition = (shelfId, partitionId) => {
    setCabinet(prev => ({
      ...prev,
      shelves: prev.shelves.map(shelf => {
        if (shelf.id === shelfId && shelf.partitions.length > 1) {
          const partitionIndex = shelf.partitions.findIndex(p => p.id === partitionId);
          const removedPartition = shelf.partitions[partitionIndex];
          const newPartitions = shelf.partitions.filter(p => p.id !== partitionId);
          
          // Add the removed partition's width to the next partition (or previous if it's the last one)
          if (partitionIndex < newPartitions.length) {
            newPartitions[partitionIndex] = {
              ...newPartitions[partitionIndex],
              width: newPartitions[partitionIndex].width + removedPartition.width
            };
          } else if (partitionIndex > 0) {
            newPartitions[partitionIndex - 1] = {
              ...newPartitions[partitionIndex - 1],
              width: newPartitions[partitionIndex - 1].width + removedPartition.width
            };
          }
          
          return { ...shelf, partitions: newPartitions };
        }
        return shelf;
      })
    }));
    
    // Clear selected partition if it was the one being removed
    if (selectedPartition?.id === partitionId) {
      setSelectedPartition(null);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Interactive Cabinet Designer</h1>
        <p className="text-slate-600">Design your cabinet by dragging edges to resize, double-clicking to add partitions, and right-clicking to remove</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        {/* Quick Controls */}
        <div className="xl:col-span-1 space-y-4">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Quick Actions</h2>
            
            <div className="space-y-3">
              <button
                onClick={addShelf}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                <Plus size={16} />
                Add Shelf
              </button>
              
              <button
                onClick={() => setCabinet(prev => ({ ...prev, shelves: prev.shelves.map(shelf => ({ ...shelf, height: 120 })) }))}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-500 text-white rounded-lg hover:bg-slate-600 transition-colors"
              >
                <RotateCcw size={16} />
                Reset Heights
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Cabinet Width</label>
                <input
                  type="range"
                  min="400"
                  max="1200"
                  step="50"
                  value={cabinet.width}
                  onChange={(e) => setCabinet(prev => ({ ...prev, width: parseInt(e.target.value) }))}
                  className="w-full"
                />
                <div className="text-xs text-slate-500 mt-1">{cabinet.width}px</div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Cabinet Height</label>
                <input
                  type="range"
                  min="300"
                  max="1000"
                  step="50"
                  value={cabinet.height}
                  onChange={(e) => setCabinet(prev => ({ ...prev, height: parseInt(e.target.value) }))}
                  className="w-full"
                />
                <div className="text-xs text-slate-500 mt-1">{cabinet.height}px</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Instructions</h2>
            <div className="space-y-3 text-sm text-slate-600">
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0"></div>
                <span>Drag partition edges to resize</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-1.5 flex-shrink-0"></div>
                <span>Drag shelf bottom to change height</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full mt-1.5 flex-shrink-0"></div>
                <span>Double-click shelf to add partition</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full mt-1.5 flex-shrink-0"></div>
                <span>Right-click partition to remove</span>
              </div>
            </div>
          </div>
        </div>

        {/* Visualization Panel */}
        <div className="xl:col-span-3 bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">
            Cabinet Design
            <span className="text-sm font-normal text-slate-500 ml-2">
              {cabinet.width}×{cabinet.height}px
            </span>
          </h2>
          
          <div className="border-2 border-slate-200 rounded-lg p-4 bg-slate-50 overflow-auto">
            <div className="flex justify-center">
              <svg
                ref={svgRef}
                width={cabinet.width * scale}
                height={cabinet.height * scale}
                className="border-2 border-slate-800 bg-white rounded-lg shadow-lg cursor-crosshair"
                style={{ userSelect: 'none' }}
              >
                {/* Cabinet frame */}
                <rect
                  x={0}
                  y={0}
                  width={cabinet.width * scale}
                  height={cabinet.height * scale}
                  fill="none"
                  stroke="#334155"
                  strokeWidth="2"
                />

                {/* Shelves */}
                {cabinet.shelves.map((shelf, shelfIndex) => {
                  const shelfY = (shelfIndex * cabinet.height / cabinet.shelves.length) * scale;
                  const shelfHeight = shelf.height * scale;
                  
                  return (
                    <g key={shelf.id}>
                      {/* Shelf base */}
                      <rect
                        x={0}
                        y={shelfY}
                        width={cabinet.width * scale}
                        height={shelfHeight}
                        fill="#f8fafc"
                        stroke="#64748b"
                        strokeWidth="1"
                        onDoubleClick={(e) => {
                          const coords = getSVGCoordinates(e);
                          addPartition(shelf.id, coords.x);
                        }}
                        onMouseEnter={() => setHoveredElement({ type: 'shelf', id: shelf.id })}
                        onMouseLeave={() => setHoveredElement(null)}
                        className="cursor-pointer hover:fill-slate-100 transition-colors"
                      />
                      
                      {/* Shelf resize handle (bottom edge) */}
                      <rect
                        x={0}
                        y={shelfY + shelfHeight - 2}
                        width={cabinet.width * scale}
                        height={4}
                        fill="transparent"
                        className="cursor-ns-resize"
                        onMouseDown={(e) => handleMouseDown(e, 'shelf', { shelfId: shelf.id })}
                      />
                      <line
                        x1={0}
                        y1={shelfY + shelfHeight}
                        x2={cabinet.width * scale}
                        y2={shelfY + shelfHeight}
                        stroke="#334155"
                        strokeWidth="2"
                        className="pointer-events-none"
                      />

                      {/* Shelf remove button */}
                      {cabinet.shelves.length > 1 && (
                        <circle
                          cx={cabinet.width * scale - 15}
                          cy={shelfY + 15}
                          r="8"
                          fill="#ef4444"
                          stroke="white"
                          strokeWidth="1"
                          className="cursor-pointer hover:fill-red-600 transition-colors"
                          onClick={() => removeShelf(shelf.id)}
                        />
                      )}
                      {cabinet.shelves.length > 1 && (
                        <text
                          x={cabinet.width * scale - 15}
                          y={shelfY + 15}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill="white"
                          fontSize="10"
                          className="pointer-events-none font-bold"
                        >
                          ×
                        </text>
                      )}

                      {/* Partitions */}
                      {shelf.partitions.map((partition, partitionIndex) => {
                        const partitionX = shelf.partitions.slice(0, partitionIndex).reduce((sum, p) => sum + p.width, 0) * scale;
                        const partitionWidth = partition.width * scale;
                        
                        return (
                          <g key={partition.id}>
                            {/* Partition area with selection */}
                            <rect
                              x={partitionX}
                              y={shelfY}
                              width={partitionWidth}
                              height={shelfHeight}
                              fill={selectedPartition?.id === partition.id ? "rgba(59, 130, 246, 0.1)" : "transparent"}
                              stroke={selectedPartition?.id === partition.id ? "#3b82f6" : "transparent"}
                              strokeWidth="2"
                              strokeDasharray={selectedPartition?.id === partition.id ? "5,5" : "none"}
                              className="cursor-pointer"
                              onClick={() => selectPartition(partition.id, shelf.id)}
                            />
                            
                            {/* Partition divider (right edge) with resize handle */}
                            {partitionIndex < shelf.partitions.length - 1 && (
                              <>
                                <rect
                                  x={partitionX + partitionWidth - 2}
                                  y={shelfY}
                                  width={4}
                                  height={shelfHeight}
                                  fill="transparent"
                                  className="cursor-ew-resize"
                                  onMouseDown={(e) => handleMouseDown(e, 'partition', { shelfId: shelf.id, partitionId: partition.id })}
                                />
                                <line
                                  x1={partitionX + partitionWidth}
                                  y1={shelfY}
                                  x2={partitionX + partitionWidth}
                                  y2={shelfY + shelfHeight}
                                  stroke="#64748b"
                                  strokeWidth="2"
                                  className="pointer-events-none"
                                />
                              </>
                            )}
                            
                            {/* Partition label */}
                            <text
                              x={partitionX + partitionWidth / 2}
                              y={shelfY + shelfHeight / 2}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fill="#64748b"
                              fontSize={Math.max(10, 12 * scale)}
                              fontFamily="system-ui, sans-serif"
                              className="pointer-events-none select-none"
                            >
                              {Math.round(partition.width)}px
                            </text>

                            {/* Partition remove button */}
                            {shelf.partitions.length > 1 && (
                              <>
                                <circle
                                  cx={partitionX + partitionWidth / 2}
                                  cy={shelfY + shelfHeight - 15}
                                  r="6"
                                  fill="#ef4444"
                                  stroke="white"
                                  strokeWidth="1"
                                  className="cursor-pointer hover:fill-red-600 transition-colors opacity-70 hover:opacity-100"
                                  onContextMenu={(e) => {
                                    e.preventDefault();
                                    removePartition(shelf.id, partition.id);
                                  }}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    removePartition(shelf.id, partition.id);
                                  }}
                                />
                                <text
                                  x={partitionX + partitionWidth / 2}
                                  y={shelfY + shelfHeight - 15}
                                  textAnchor="middle"
                                  dominantBaseline="middle"
                                  fill="white"
                                  fontSize="8"
                                  className="pointer-events-none font-bold"
                                >
                                  ×
                                </text>
                              </>
                            )}
                          </g>
                        );
                      })}
                    </g>
                  );
                })}
                
                {/* Drag cursor indicator */}
                {dragging && (
                  <circle
                    cx={dragStart.x * scale}
                    cy={dragStart.y * scale}
                    r="3"
                    fill="#3b82f6"
                    className="pointer-events-none"
                  />
                )}
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CabinetVisualizer;
