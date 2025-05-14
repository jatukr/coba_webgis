import React, { useState, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, LayersControl, GeoJSON, FeatureGroup, useMap } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import L from 'leaflet';
import { 
  TextField, 
  Button, 
  Box, 
  IconButton, 
  Tooltip, 
  CircularProgress,
  useTheme,
  useMediaQuery,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  Switch,
  FormControlLabel,
  Menu,
  MenuItem,
  Paper
} from '@mui/material';
import { 
  Brightness4, 
  Brightness7, 
  Menu as MenuIcon,
  Search as SearchIcon,
  Upload as UploadIcon,
  Delete as DeleteIcon,
  FileDownload as FileDownloadIcon,
  Room as RoomIcon
} from '@mui/icons-material';
import * as shapefile from 'shapefile';
import { saveAs } from 'file-saver';
import * as shpwrite from 'shp-write';
import JSZip from 'jszip';
import chroma from 'chroma-js';
import { SearchBox } from './SearchBox';

// Fix for default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

// Create a separate component for EditControl
const DrawControl = ({ onCreated, onEdited, onDeleted }) => {
  const map = useMap();
  const featureGroupRef = useRef();
  
  useEffect(() => {
    if (!map) return;
    
    const featureGroup = new L.FeatureGroup();
    map.addLayer(featureGroup);
    featureGroupRef.current = featureGroup;

    const drawControl = new L.Control.Draw({
      position: 'bottomright',
      draw: {
        polygon: true,
        rectangle: false,
        circle: false,
        circlemarker: false,
        marker: false,
        polyline: false
      },
      edit: {
        featureGroup: featureGroup,
        remove: true,
        edit: {
          selectedPathOptions: {
            maintainColor: true,
            dashArray: '10, 10'
          }
        }
      }
    });

    map.addControl(drawControl);

    map.on(L.Draw.Event.CREATED, (e) => {
      const layer = e.layer;
      featureGroup.addLayer(layer);
      
      // Add popup to the drawn shape
      if (layer instanceof L.Polygon) {
        layer.bindPopup(`
          <div style="max-width: 300px;">
            <h4 style="margin: 0 0 10px 0;">Drawn Shape</h4>
            <p>Area: ${L.GeometryUtil.geodesicArea(layer.getLatLngs()[0]).toFixed(2)} m²</p>
          </div>
        `);
      }
      
      if (onCreated) onCreated(e);
    });

    map.on(L.Draw.Event.EDITED, (e) => {
      const layers = e.layers;
      layers.eachLayer((layer) => {
        if (layer instanceof L.Polygon) {
          layer.bindPopup(`
            <div style="max-width: 300px;">
              <h4 style="margin: 0 0 10px 0;">Drawn Shape</h4>
              <p>Area: ${L.GeometryUtil.geodesicArea(layer.getLatLngs()[0]).toFixed(2)} m²</p>
            </div>
          `);
        }
      });
      if (onEdited) onEdited(e);
    });

    map.on(L.Draw.Event.DELETED, (e) => {
      if (onDeleted) onDeleted(e);
    });

    return () => {
      map.removeControl(drawControl);
      map.removeLayer(featureGroup);
    };
  }, [map, onCreated, onEdited, onDeleted]);

  return null;
};

const colorMap = {
  CA: '#008000',    // hijau
  SM: '#FFD700',    // kuning
  TWA: '#FF0000'     // merah
};

function Map() {
  const [searchQuery, setSearchQuery] = useState('');
  const [markers, setMarkers] = useState([{ position: [-7.257562035423769, 112.75113124540582], name: 'Surabaya, Indonesia' }]);
  const [layers, setLayers] = useState(() => {
    // Load layers from localStorage on initial render
    const savedLayers = localStorage.getItem('mapLayers');
    return savedLayers ? JSON.parse(savedLayers) : [];
  });
  const [layerName, setLayerName] = useState('Data Layer');
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedColor, setSelectedColor] = useState('#3388ff');
  const [selectedStyle, setSelectedStyle] = useState('solid');
  const [selectedWeight, setSelectedWeight] = useState(3);
  const [selectedOpacity, setSelectedOpacity] = useState(0.2);
  const [isLoading, setIsLoading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedMode = localStorage.getItem('darkMode');
    return savedMode ? JSON.parse(savedMode) : false;
  });
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const featureGroupRef = useRef();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [exportMenuAnchor, setExportMenuAnchor] = useState(null);
  const [selectedLayerForExport, setSelectedLayerForExport] = useState(null);
  const [customCategoryColors, setCustomCategoryColors] = useState({});
  const mapRef = useRef();
  const [uploadedLayers, setUploadedLayers] = useState([]);
  const [layerNames, setLayerNames] = useState({});

  // Style options
  const styleOptions = [
    { value: 'solid', label: 'Solid' },
    { value: 'dashed', label: 'Dashed' },
    { value: 'dotted', label: 'Dotted' }
  ];

  // Get style based on selected options
  const getLayerStyle = (layer) => {
    let dashArray;
    switch (layer.style) {
      case 'dashed':
        dashArray = '10, 10';
        break;
      case 'dotted':
        dashArray = '2, 2';
        break;
      default:
        dashArray = null;
    }

    return {
      color: layer.color,
      weight: layer.weight,
      opacity: 1,
      fillOpacity: layer.opacity,
      fillColor: layer.color,
      dashArray: dashArray
    };
  };

  // Save layers to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('mapLayers', JSON.stringify(layers));
  }, [layers]);

  // Save dark mode preference
  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
    document.body.style.backgroundColor = isDarkMode ? '#121212' : '#ffffff';
  }, [isDarkMode]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsLoading(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`
      );
      const data = await response.json();
      if (data.length > 0) {
        const newMarker = {
          position: [parseFloat(data[0].lat), parseFloat(data[0].lon)],
          name: data[0].display_name
        };
        setMarkers([...markers, newMarker]);
        // Pindahkan tampilan peta ke lokasi hasil pencarian
        if (mapRef.current) {
          mapRef.current.setView(newMarker.position, 15, { animate: true });
        }
      }
    } catch (error) {
      console.error('Error searching location:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (event) => {
    setSelectedFile(event.target.files);
  };

  const handleFileSubmit = async () => {
    if (!selectedFile || selectedFile.length === 0) {
      alert('Pilih file terlebih dahulu');
      return;
    }

    setIsLoading(true);
    try {
      let geojson;
      // Jika ZIP
      if (selectedFile.length === 1 && selectedFile[0].name.toLowerCase().endsWith('.zip')) {
        if (selectedFile[0].type !== 'application/zip' && selectedFile[0].type !== 'application/x-zip-compressed') {
          alert('File yang diupload bukan file ZIP yang valid.');
          return;
        }
        let zipContent;
        try {
          const arrayBuffer = await selectedFile[0].arrayBuffer();
          const zip = new JSZip();
          zipContent = await zip.loadAsync(arrayBuffer);
        } catch (err) {
          alert('File ZIP tidak valid atau rusak.');
          console.error('JSZip error:', err);
          return;
        }
        
        // Find .shp and .dbf files
        const shpFile = Object.values(zipContent.files).find(f => f.name.toLowerCase().endsWith('.shp'));
        const dbfFile = Object.values(zipContent.files).find(f => f.name.toLowerCase().endsWith('.dbf'));
        
        if (!shpFile || !dbfFile) {
          throw new Error('ZIP file must contain both .shp and .dbf files');
        }

        // Get file contents
        const [shpBuffer, dbfBuffer] = await Promise.all([
          shpFile.async('arraybuffer'),
          dbfFile.async('arraybuffer')
        ]);
        
        // Convert shapefile to GeoJSON
        geojson = await shapefile.read(shpBuffer, dbfBuffer);
      } 
      // Jika GeoJSON/JSON
      else if (selectedFile.length === 1 && (
        selectedFile[0].name.toLowerCase().endsWith('.geojson') ||
        selectedFile[0].name.toLowerCase().endsWith('.json')
      )) {
        const file = selectedFile[0];
        const reader = new FileReader();
        geojson = await new Promise((resolve, reject) => {
          reader.onload = (e) => {
            try {
              resolve(JSON.parse(e.target.result));
            } catch (err) {
              reject(err);
            }
          };
          reader.onerror = reject;
          reader.readAsText(file);
        });
      }
      // Jika SHP/DBF
      else {
        // Cari file .shp dan .dbf
        const shpFile = Array.from(selectedFile).find(file => file.name.toLowerCase().endsWith('.shp'));
        const dbfFile = Array.from(selectedFile).find(file => file.name.toLowerCase().endsWith('.dbf'));
        if (!shpFile || !dbfFile) {
          throw new Error('Please upload both .shp and .dbf files');
        }
        const [shpBuffer, dbfBuffer] = await Promise.all([
          shpFile.arrayBuffer(),
          dbfFile.arrayBuffer()
        ]);
        geojson = await shapefile.read(shpBuffer, dbfBuffer);
      }

      // Add new layer to layers array
      const newLayer = {
        id: Date.now(),
        name: layerName,
        data: geojson,
        color: selectedColor,
        style: selectedStyle,
        weight: selectedWeight,
        opacity: selectedOpacity,
        timestamp: new Date().toISOString(),
        classifyField: '',
        categoryColors: {}
      };

      setLayers([...layers, newLayer]);
      setLayerName('Data Layer');
      setSelectedFile(null);
    } catch (error) {
      console.error('Error processing file:', error);
      alert(error.message || 'Error processing file. Please make sure you have uploaded all necessary shapefile components (.shp and .dbf)');
    } finally {
      setIsLoading(false);
    }
  };

  const removeLayer = (layerId) => {
    setLayers(layers.filter(layer => layer.id !== layerId));
  };

  const clearAllLayers = () => {
    if (window.confirm('Apakah Anda yakin ingin menghapus semua layer?')) {
      setLayers([]);
      localStorage.removeItem('mapLayers');
    }
  };

  const _onCreated = (e) => {
    const layer = e.layer;
    console.log('Created layer:', layer);
  };

  const _onEdited = (e) => {
    const layers = e.layers;
    layers.eachLayer((layer) => {
      console.log('Edited layer:', layer);
    });
  };

  const _onDeleted = (e) => {
    const layers = e.layers;
    layers.eachLayer((layer) => {
      console.log('Deleted layer:', layer);
    });
  };

  const updateLayerStyle = (layerId, style, value) => {
    setLayers(layers.map(layer => 
      layer.id === layerId ? { ...layer, [style]: value } : layer
    ));
  };

  const handleExportMenuOpen = (event, layer) => {
    setExportMenuAnchor(event.currentTarget);
    setSelectedLayerForExport(layer);
  };

  const handleExportMenuClose = () => {
    setExportMenuAnchor(null);
    setSelectedLayerForExport(null);
  };

  const exportToGeoJSON = (layer) => {
    const geojson = layer.data;
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
    saveAs(blob, `${layer.name}.geojson`);
  };

  const exportToShapefile = async (layer) => {
    try {
      const geojson = layer.data;
      const options = {
        folder: layer.name,
        types: {
          point: 'points',
          polygon: 'polygons',
          line: 'lines'
        }
      };

      shpwrite.zip(geojson, options, (err, zip) => {
        if (err) {
          console.error('Error creating shapefile:', err);
          alert('Error creating shapefile. Please try again.');
          return;
        }
        saveAs(zip, `${layer.name}.zip`);
      });
    } catch (error) {
      console.error('Error exporting to shapefile:', error);
      alert('Error exporting to shapefile. Please try again.');
    }
  };

  // Fungsi hapus marker
  const removeMarker = (index) => {
    setMarkers(markers.filter((_, i) => i !== index));
  };

  // Remove the useEffect that was initializing draw control manually
  useEffect(() => {
    if (!mapRef.current) return;
  }, [mapRef.current]);

  useEffect(() => {
    // Load layer kawasan konservasi saat pertama kali buka
    fetch('/kkbksda.geojson')
      .then(res => res.json())
      .then(data => {
        // Cek apakah layer kawasan konservasi sudah ada
        const existingLayer = layers.find(layer => layer.id === 'kawasan-konservasi');
        if (!existingLayer) {
          setLayers(layers => [
            ...layers,
            {
              id: 'kawasan-konservasi',
              name: 'Kawasan Konservasi',
              data: data,
              color: '#3388ff',
              style: 'solid',
              weight: 3,
              opacity: 0.2,
              timestamp: new Date().toISOString(),
              classifyField: 'FUNGSI',
              categoryColors: colorMap
            }
          ]);
        }
      })
      .catch(err => {
        console.error('Gagal load layer kawasan konservasi:', err);
      });
  }, []); // Hapus layers dari dependency array

  return (
    <Box sx={{ 
      position: 'relative', 
      width: '100%', 
      height: '100vh',
      '& .leaflet-container': {
        height: '100%',
        width: '100%',
        zIndex: 1
      },
      '& .leaflet-control-layers': {
        transform: 'translateX(-10px) !important'
      }
    }}>
      <AppBar 
        position="static" 
        color={isDarkMode ? "default" : "primary"}
        sx={{ 
          backgroundColor: isDarkMode ? '#1f1f1f' : undefined,
          boxShadow: 1
        }}
      >
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => setIsDrawerOpen(true)}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Aplikasi WebGIS
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={isDarkMode}
                onChange={(e) => setIsDarkMode(e.target.checked)}
                color="default"
              />
            }
            label={isDarkMode ? <Brightness7 /> : <Brightness4 />}
          />
        </Toolbar>
      </AppBar>

      <MapContainer
        center={[-7.2558591714853, 112.74357814457998]}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        ref={mapRef}
        zoomControl={false}
      >
        <LayersControl position="bottomright">
          <LayersControl.BaseLayer checked name="OpenStreetMap">
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satellite">
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Terrain">
            <TileLayer
              url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://opentopomap.org">OpenTopoMap</a> contributors'
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Dark">
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="OSM Indonesia">
            <TileLayer
              url="https://tile.openstreetmap.id/hot/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
          </LayersControl.BaseLayer>

          {layers.map((layer) => (
            <LayersControl.Overlay 
              key={layer.id}
              checked 
              name={layer.name}
            >
              <GeoJSON 
                data={layer.data}
                style={feature => {
                  if (layer.classifyField) {
                    const value = feature.properties[layer.classifyField];
                    return {
                      color: layer.categoryColors[value] || '#3388ff',
                      weight: layer.weight,
                      opacity: 1,
                      fillOpacity: layer.opacity,
                      fillColor: layer.categoryColors[value] || '#3388ff'
                    };
                  }
                  // Jika tidak ada klasifikasi, gunakan style default
                  return {
                    color: layer.color,
                    weight: layer.weight,
                    opacity: 1,
                    fillOpacity: layer.opacity,
                    fillColor: layer.color
                  };
                }}
                onEachFeature={(feature, leafletLayer) => {
                  if (feature.properties) {
                    let popupContent;
                    if (layer.id === 'kawasan-konservasi') {
                      // Khusus untuk layer kawasan konservasi, tampilkan FUNGSI di awal
                      const fungsi = feature.properties.FUNGSI;
                      popupContent = `
                        <div style="max-width: 300px;">
                          <h4 style="margin: 0 0 10px 0;">${layer.name}</h4>
                          <div style="margin-bottom: 10px; padding: 8px; background-color: ${colorMap[fungsi] || '#3388ff'}; color: white; border-radius: 4px;">
                            <strong>FUNGSI:</strong> ${fungsi || 'Tidak ada data'}
                          </div>
                          <table style="width: 100%; border-collapse: collapse;">
                            ${Object.entries(feature.properties)
                              .filter(([key, value]) => value !== undefined && value !== null && key !== 'FUNGSI')
                              .map(([key, value]) => `
                                <tr>
                                  <td style="padding: 4px; border-bottom: 1px solid #eee; font-weight: bold;">${key}</td>
                                  <td style="padding: 4px; border-bottom: 1px solid #eee;">${value}</td>
                                </tr>
                              `).join('')}
                          </table>
                        </div>
                      `;
                    } else {
                      // Untuk layer lain, tampilkan semua properti seperti biasa
                      popupContent = `
                        <div style="max-width: 300px;">
                          <h4 style="margin: 0 0 10px 0;">${layer.name}</h4>
                          <table style="width: 100%; border-collapse: collapse;">
                            ${Object.entries(feature.properties)
                              .filter(([key, value]) => value !== undefined && value !== null)
                              .map(([key, value]) => `
                                <tr>
                                  <td style="padding: 4px; border-bottom: 1px solid #eee; font-weight: bold;">${key}</td>
                                  <td style="padding: 4px; border-bottom: 1px solid #eee;">${value}</td>
                                </tr>
                              `).join('')}
                          </table>
                        </div>
                      `;
                    }
                    leafletLayer.bindPopup(popupContent);
                  } else {
                    leafletLayer.bindPopup(`
                      <div style="max-width: 300px;">
                        <h4 style="margin: 0 0 10px 0;">${layer.name}</h4>
                        <p>No properties available</p>
                      </div>
                    `);
                  }
                }}
              />
            </LayersControl.Overlay>
          ))}
        </LayersControl>

        <FeatureGroup>
          <DrawControl
            onCreated={_onCreated}
            onEdited={_onEdited}
            onDeleted={_onDeleted}
          />
        </FeatureGroup>

        {markers.map((marker, index) => (
          <Marker key={index} position={marker.position}>
            <Popup>
              {marker.name}
            </Popup>
          </Marker>
        ))}

        <div className="leaflet-control-container">
          <div className="leaflet-control-zoom leaflet-bar leaflet-control" style={{ position: 'absolute', bottom: '20px', left: '10px' }}>
            <button className="leaflet-control-zoom-in" aria-label="Zoom in" title="Zoom in">+</button>
            <button className="leaflet-control-zoom-out" aria-label="Zoom out" title="Zoom out">−</button>
          </div>
        </div>
      </MapContainer>

      <Drawer
        anchor="left"
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        sx={{
          '& .MuiDrawer-paper': {
            width: isMobile ? '100%' : 350,
            backgroundColor: isDarkMode ? '#1f1f1f' : '#ffffff',
            color: isDarkMode ? '#ffffff' : '#000000'
          }
        }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Kontrol Peta
          </Typography>

          <TextField
            fullWidth
            size="small"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari lokasi..."
            sx={{ mb: 1 }}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSearch();
              }
            }}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: 'action.active' }} />,
            }}
          />
          <Button
            variant="contained"
            onClick={handleSearch}
            fullWidth
            disabled={isLoading}
            sx={{ mb: 2 }}
          >
            {isLoading ? <CircularProgress size={20} /> : 'Cari'}
          </Button>

          <input
            type="file"
            accept=".geojson,.json,.shp,.zip"
            onChange={handleFileSelect}
            style={{ marginBottom: '10px' }}
            id="file-upload"
            multiple
          />
          <label htmlFor="file-upload">
            <Button
              variant="contained"
              component="span"
              fullWidth
              startIcon={<UploadIcon />}
              sx={{ mb: 2 }}
            >
              Pilih File
            </Button>
          </label>

          <Button
            variant="contained"
            onClick={handleFileSubmit}
            fullWidth
            sx={{ mb: 2 }}
            disabled={isLoading || !selectedFile}
            startIcon={isLoading ? <CircularProgress size={20} /> : <UploadIcon />}
          >
            {isLoading ? 'Uploading...' : 'Upload Layer'}
          </Button>

          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Upload Layer
          </Typography>

          <TextField
            fullWidth
            size="small"
            value={layerName}
            onChange={(e) => setLayerName(e.target.value)}
            placeholder="Nama Layer"
            sx={{ mb: 1 }}
          />

          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Warna Layer:</label>
            <input
              type="color"
              value={selectedColor}
              onChange={(e) => setSelectedColor(e.target.value)}
              style={{ width: '100%', height: '40px' }}
            />
          </div>

          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Style Garis:</label>
            <select
              value={selectedStyle}
              onChange={(e) => setSelectedStyle(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px' }}
            >
              {styleOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Ketebalan Garis:</label>
            <input
              type="range"
              min="1"
              max="10"
              value={selectedWeight}
              onChange={(e) => setSelectedWeight(Number(e.target.value))}
              style={{ width: '100%' }}
            />
            <span style={{ fontSize: '12px' }}>{selectedWeight}px</span>
          </div>

          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Opacity Fill:</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={selectedOpacity}
              onChange={(e) => setSelectedOpacity(Number(e.target.value))}
              style={{ width: '100%' }}
            />
            <span style={{ fontSize: '12px' }}>{selectedOpacity}</span>
          </div>

          {/* Layer List */}
          {layers.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <Typography variant="subtitle1">
                  Layer yang Diupload
                </Typography>
                <Tooltip title="Hapus semua layer">
                  <IconButton
                    size="small"
                    color="error"
                    onClick={clearAllLayers}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
              </div>
              {layers.map((layer) => (
                <div 
                  key={layer.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '10px',
                    borderBottom: `1px solid ${isDarkMode ? '#333' : '#eee'}`,
                    backgroundColor: isDarkMode ? '#2d2d2d' : '#f5f5f5',
                    borderRadius: '4px',
                    marginBottom: '8px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <div
                        style={{
                          width: '12px',
                          height: '12px',
                          backgroundColor: layer.color,
                          marginRight: '8px',
                          borderRadius: '2px'
                        }}
                      />
                      <span>{layer.name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Tooltip title="Ekspor Layer">
                        <IconButton
                          size="small"
                          onClick={(e) => handleExportMenuOpen(e, layer)}
                          sx={{ 
                            backgroundColor: isDarkMode ? '#3d3d3d' : '#e0e0e0',
                            '&:hover': {
                              backgroundColor: isDarkMode ? '#4d4d4d' : '#d0d0d0'
                            }
                          }}
                        >
                          <FileDownloadIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Hapus Layer">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => removeLayer(layer.id)}
                          sx={{ 
                            backgroundColor: isDarkMode ? '#3d3d3d' : '#e0e0e0',
                            '&:hover': {
                              backgroundColor: isDarkMode ? '#4d4d4d' : '#d0d0d0'
                            }
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '5px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        type="color"
                        value={layer.color}
                        onChange={(e) => updateLayerStyle(layer.id, 'color', e.target.value)}
                        style={{ width: '30px', height: '30px' }}
                      />
                      <span style={{ fontSize: '12px' }}>Warna</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <select
                        value={layer.style}
                        onChange={(e) => updateLayerStyle(layer.id, 'style', e.target.value)}
                        style={{ width: '100px', padding: '4px' }}
                      >
                        {styleOptions.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <span style={{ fontSize: '12px' }}>Style</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={layer.weight}
                        onChange={(e) => updateLayerStyle(layer.id, 'weight', Number(e.target.value))}
                        style={{ width: '100px' }}
                      />
                      <span style={{ fontSize: '12px' }}>Ketebalan</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={layer.opacity}
                        onChange={(e) => updateLayerStyle(layer.id, 'opacity', Number(e.target.value))}
                        style={{ width: '100px' }}
                      />
                      <span style={{ fontSize: '12px' }}>Opacity</span>
                    </div>
                  </div>
                  <div style={{ fontSize: '10px', color: 'gray', marginTop: '5px' }}>
                    Diupload: {new Date(layer.timestamp).toLocaleString()}
                  </div>
                  {layer.data.features && layer.data.features.length > 0 && (
                    <div style={{ marginTop: '10px' }}>
                      <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>
                        Klasifikasi Warna:
                      </label>
                      <select
                        value={layer.classifyField || ''}
                        onChange={e => {
                          const field = e.target.value;
                          const features = layer.data.features;
                          let newCategoryColors = {};
                          if (field) {
                            if (layer.id === 'kawasan-konservasi' && field === 'FUNGSI') {
                              newCategoryColors = colorMap;
                            } else {
                              const uniqueValues = Array.from(new Set(features.map(f => f.properties?.[field])));
                              const colorScale = chroma.scale('Set2').colors(uniqueValues.length);
                              uniqueValues.forEach((val, idx) => {
                                newCategoryColors[val] = colorScale[idx];
                              });
                            }
                          }
                          setLayers(layers.map(l =>
                            l.id === layer.id
                              ? { ...l, classifyField: field, categoryColors: newCategoryColors }
                              : l
                          ));
                        }}
                        style={{ width: '100%', padding: '4px', fontSize: '12px' }}
                      >
                        <option value="">Tidak ada klasifikasi</option>
                        {Object.keys(layer.data.features[0].properties || {}).map(field => (
                          <option key={field} value={field}>{field}</option>
                        ))}
                      </select>
                      {/* Legenda */}
                      {layer.classifyField && Object.keys(layer.categoryColors).length > 0 && (
                        <div style={{ marginTop: '5px', fontSize: '12px' }}>
                          <b>Legenda:</b>
                          <ul style={{ listStyle: 'none', padding: 0, margin: '5px 0' }}>
                            {Object.entries(layer.categoryColors).map(([value, color]) => (
                              <li key={value} style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
                                <input
                                  type="color"
                                  value={color}
                                  onChange={e => {
                                    setLayers(layers.map(l => {
                                      if (l.id === layer.id) {
                                        return {
                                          ...l,
                                          categoryColors: {
                                            ...l.categoryColors,
                                            [value]: e.target.value
                                          }
                                        };
                                      }
                                      return l;
                                    }));
                                  }}
                                  style={{ width: 20, height: 20, marginRight: 5 }}
                                />
                                <span>{value || '(kosong)'}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Marker List in Drawer */}
          {markers.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Daftar Marker
              </Typography>
              {markers.map((marker, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', background: isDarkMode ? '#2d2d2d' : '#f5f5f5', borderRadius: 4, padding: '6px 8px', marginBottom: 6 }}>
                  <RoomIcon fontSize="small" sx={{ color: '#1976d2', mr: 1 }} />
                  <span style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{marker.name}</span>
                  <Tooltip title="Hapus Marker">
                    <IconButton size="small" color="error" onClick={() => removeMarker(idx)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </div>
              ))}
            </div>
          )}
        </Box>
      </Drawer>

      {/* Mobile Search Bar */}
      {isMobile && (
        <Box
          sx={{
            position: 'absolute',
            top: 80,
            left: 10,
            right: 10,
            zIndex: 1000,
            backgroundColor: isDarkMode ? '#1f1f1f' : '#ffffff',
            padding: 1,
            borderRadius: 1,
            boxShadow: 3,
          }}
        >
          <TextField
            fullWidth
            size="small"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari lokasi..."
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSearch();
              }
            }}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: 'action.active' }} />,
            }}
          />
        </Box>
      )}

      <Menu
        anchorEl={exportMenuAnchor}
        open={Boolean(exportMenuAnchor)}
        onClose={handleExportMenuClose}
        PaperProps={{
          sx: {
            mt: 1,
            backgroundColor: isDarkMode ? '#2d2d2d' : '#ffffff',
            '& .MuiMenuItem-root': {
              color: isDarkMode ? '#ffffff' : '#000000',
              '&:hover': {
                backgroundColor: isDarkMode ? '#3d3d3d' : '#f5f5f5'
              }
            }
          }
        }}
      >
        <MenuItem 
          onClick={() => {
            exportToGeoJSON(selectedLayerForExport);
            handleExportMenuClose();
          }}
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <FileDownloadIcon fontSize="small" />
          Export as GeoJSON
        </MenuItem>
        <MenuItem 
          onClick={() => {
            exportToShapefile(selectedLayerForExport);
            handleExportMenuClose();
          }}
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <FileDownloadIcon fontSize="small" />
          Export as Shapefile
        </MenuItem>
      </Menu>

      {(() => {
        const getLegendHeight = (layer) => 40 + Object.keys(layer.categoryColors).length * 28 + 10;
        let legendTop = 70;
        return layers.filter(l => l.classifyField).map((layer, idx) => {
          const style = {
            position: 'absolute',
            top: legendTop,
            right: 20,
            marginTop: idx > 0 ? 20 : 0,
            background: isDarkMode ? '#2d2d2d' : '#ffffff',
            padding: 10,
            borderRadius: 8,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            zIndex: 1000,
            color: isDarkMode ? '#ffffff' : '#000000',
            maxWidth: '250px'
          };
          const el = (
            <div key={layer.id} style={style}>
              <b>Legenda: {layer.name} - {layer.classifyField}</b>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {Object.entries(layer.categoryColors).map(([value, color]) => (
                  <li key={value} style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                    <input
                      type="color"
                      value={color}
                      onChange={e => {
                        setLayers(layers.map(l => {
                          if (l.id === layer.id) {
                            return {
                              ...l,
                              categoryColors: {
                                ...l.categoryColors,
                                [value]: e.target.value
                              }
                            };
                          }
                          return l;
                        }));
                      }}
                      style={{ width: 24, height: 24, marginRight: 8, border: '1px solid #ccc', borderRadius: 3, background: 'none', padding: 0 }}
                    />
                    <span>{value || '(kosong)'}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
          legendTop += getLegendHeight(layer) + 0; // 0 karena margin-top sudah diatur di style
          return el;
        });
      })()}
    </Box>
  );
}

export default Map; 