# UMD Nexus Cluster Status Dashboard

A Jekyll-based GitHub Pages website for monitoring UMIACS Nexus cluster partition usage and resource allocation in real-time.

## Features

- **Real-time cluster monitoring** - Auto-refreshing dashboard with 10-second intervals
- **Partition filtering** - View all partitions or filter by specific ones (PCI, Tron, CBCB, etc.)
- **Node overview** - CPU, GPU, and memory availability across cluster nodes
- **User job tracking** - Detailed resource usage per user with current user highlighting
- **Responsive design** - Terminal-style interface that works on desktop and mobile
- **GitHub Pages compatible** - Easy deployment and hosting

## Quick Start

### 1. Fork and Clone
```bash
git clone https://github.com/yourusername/nexus-cluster-status.git
cd nexus-cluster-status
```

### 2. Install Dependencies
```bash
# Install Ruby and Bundler first, then:
bundle install
```

### 3. Local Development
```bash
bundle exec jekyll serve
# Visit http://localhost:4000
```

### 4. Deploy to GitHub Pages
1. Push to your GitHub repository
2. Go to Settings > Pages
3. Select "Deploy from a branch" and choose `main` branch
4. Your site will be available at `https://yourusername.github.io/nexus-cluster-status`

## Configuration

### Basic Setup
Edit `_config.yml` to customize:
```yaml
title: "Your Cluster Name Status"
description: "Resource monitoring for your cluster"
url: "https://yourusername.github.io"
refresh_interval: 10 # seconds
```

### Data Integration

#### Option 1: Static Data (Quick Start)
The site comes with mock data that matches your screenshots. Edit the `clusterData` object in `index.html` to match your actual data structure.

#### Option 2: API Integration
Create an API endpoint that returns JSON in this format:
```json
{
  "timestamp": "2025-06-01T00:20:12Z",
  "nodes": [
    {
      "NodeName": "node209",
      "CPUTot": 104,
      "AllocCPUs": 0,
      "TotalGRES": "gpu:a6000:10",
      "AllocGRES": "gpu:0",
      "RealMemory": 524288,
      "AllocMem": 122880,
      "FreeMem": 401408,
      "State": "draining"
    }
  ],
  "partitions": {
    "pci": {
      "currentUser": "tb21",
      "users": [
        {
          "name": "tb21 (Tanushree Banerjee)",
          "jobs": [
            {
              "node": "node209",
              "cpu": 20,
              "cpuTotal": 104,
              "gpu": 10,
              "gpuTotal": 10,
              "mem": 107374182400,
              "memTotal": 536870912000
            }
          ],
          "totalCpu": 60,
          "totalCpuAvailable": 6000,
          "totalGpu": 30,
          "totalGpuAvailable": 800,
          "totalMem": 322122547200,
          "totalMemAvailable": 32212254720000
        }
      ]
    }
  }
}
```

Update the `apiEndpoint` in `_includes/data-fetcher.js`:
```javascript
const fetcher = new NexusDataFetcher('/api/your-cluster-endpoint');
```

#### Option 3: SLURM Integration
For direct SLURM integration, you'll need a backend service that runs commands like:
```bash
# Get node info
sinfo -N -o "%N %C %G %m %T"

# Get job info  
squeue -o "%i %j %u %P %t %M %D %C %m %N"

# Get partition info
scontrol show partition
```

Create a simple Python/Node.js API that processes this data and serves it as JSON.

## File Structure

```
nexus-cluster-status/
├── _config.yml                 # Jekyll configuration
├── _layouts/
│   └── default.html            # Base page template
├── _includes/
│   └── data-fetcher.js         # Data fetching utilities
├── assets/
│   └── css/
│       └── main.css           # Terminal-style CSS
├── index.html                  # Main dashboard page
├── Gemfile                     # Ruby dependencies
└── README.md                   # This file
```

## Customization

### Adding New Partitions
Edit the partition selector in `index.html`:
```html
<select id="partition-select">
    <option value="all">All Partitions</option>
    <option value="your-partition">Your Partition</option>
</select>
```

### Styling Changes
Modify `assets/css/main.css` to change:
- Colors (currently terminal green/yellow theme)
- Fonts (using JetBrains Mono)
- Layout spacing
- Responsive breakpoints

### Data Refresh Rate
Change refresh interval in `_config.yml` or override in JavaScript:
```javascript
const fetcher = new NexusDataFetcher('/api/endpoint');
fetcher.refreshInterval = 5000; // 5 seconds
```

## Security Considerations

- **API Access**: Ensure your cluster data API is properly secured
- **User Privacy**: Consider masking sensitive user information
- **Rate Limiting**: Implement appropriate rate limiting on your data endpoints
- **CORS**: Configure CORS if your API is on a different domain

## Troubleshooting

### GitHub Pages Build Errors
- Ensure all gems are GitHub Pages compatible
- Check `_config.yml` syntax
- Verify file paths are correct

### Data Not Loading
- Check browser console for errors
- Verify API endpoint is accessible
- Test with static data first

### Performance Issues
- Increase refresh interval for large clusters
- Consider pagination for many partitions/users
- Optimize CSS for better rendering

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally with `bundle exec jekyll serve`
5. Submit a pull request

## License

MIT License - feel free to adapt for your institution's needs.

## Support

For UMIACS-specific questions, refer to the [official Nexus documentation](https://wiki.umiacs.umd.edu/umiacs/index.php/Nexus).

For website issues, please open a GitHub issue with:
- Your Jekyll version
- Browser and OS
- Console error messages
- Steps to reproduce