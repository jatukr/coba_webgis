import React, { useState } from 'react';
import { 
  Box, 
  TextField, 
  Button, 
  Typography, 
  CircularProgress,
  Paper,
  useTheme
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

export const SearchBox = ({ onFileUpload }) => {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`
      );
      const data = await response.json();
      
      if (data.length > 0) {
        const { lat, lon } = data[0];
        // Handle search result
        console.log('Search result:', { lat, lon });
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      onFileUpload(file);
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Paper
        elevation={0}
        sx={{
          p: 2,
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(8px)',
          borderRadius: 2,
          border: '1px solid rgba(255, 255, 255, 0.2)',
        }}
      >
        <Typography variant="subtitle1" sx={{ mb: 2, color: theme.palette.text.primary, fontWeight: 500 }}>
          Search Location
        </Typography>
        
        <TextField
          fullWidth
          size="small"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Enter location..."
          sx={{
            mb: 2,
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 1)',
              },
            },
          }}
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
          sx={{
            mb: 2,
            borderRadius: 2,
            textTransform: 'none',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            '&:hover': {
              boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
            },
          }}
        >
          {isLoading ? <CircularProgress size={24} /> : 'Search'}
        </Button>

        <Typography variant="subtitle1" sx={{ mb: 2, color: theme.palette.text.primary, fontWeight: 500 }}>
          Upload Data
        </Typography>

        <Button
          component="label"
          variant="outlined"
          fullWidth
          startIcon={<CloudUploadIcon />}
          sx={{
            borderRadius: 2,
            textTransform: 'none',
            borderStyle: 'dashed',
            borderWidth: 2,
            '&:hover': {
              borderWidth: 2,
            },
          }}
        >
          {selectedFile ? selectedFile.name : 'Choose File'}
          <input
            type="file"
            hidden
            accept=".geojson,.shp,.zip"
            onChange={handleFileChange}
          />
        </Button>
      </Paper>
    </Box>
  );
}; 