#!/bin/bash
# Complete setup script for Nexus Cluster Status Dashboard

set -e  # Exit on any error

echo "🚀 Setting up Nexus Cluster Status Dashboard..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}=== $1 ===${NC}"
}

# Check if conda is installed
check_conda() {
    if ! command -v conda &> /dev/null; then
        print_error "Conda is not installed or not in PATH"
        print_status "Please install Miniconda/Anaconda first:"
        print_status "https://docs.conda.io/en/latest/miniconda.html"
        exit 1
    fi
    print_status "Conda found: $(conda --version)"
}

# Create conda environment
setup_conda_env() {
    print_header "Setting up Conda Environment"
    
    ENV_NAME="nexus-cluster-status"
    
    # Check if environment already exists
    if conda env list | grep -q "^${ENV_NAME}\s"; then
        print_warning "Environment '${ENV_NAME}' already exists"
        read -p "Do you want to remove and recreate it? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_status "Removing existing environment..."
            conda env remove -n $ENV_NAME -y
        else
            print_status "Using existing environment"
            conda activate $ENV_NAME
            return 0
        fi
    fi
    
    # Create environment from file
    if [ -f "environment.yml" ]; then
        print_status "Creating environment from environment.yml..."
        conda env create -f environment.yml
    else
        print_status "Creating basic environment..."
        conda create -n $ENV_NAME python=3.11 -y
        conda activate $ENV_NAME
        
        # Install basic packages
        conda install -c conda-forge flask pandas numpy requests click pyyaml -y
        pip install flask-cors schedule python-crontab
    fi
    
    print_status "Activating environment..."
    conda activate $ENV_NAME
}

# Setup Ruby/Jekyll (optional)
setup_jekyll() {
    print_header "Setting up Jekyll (Optional)"
    
    read -p "Do you want to set up Jekyll for local development? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Check if Ruby is available
        if command -v ruby &> /dev/null; then
            print_status "Ruby found: $(ruby --version)"
            
            # Install bundler
            if ! gem list bundler -i > /dev/null 2>&1; then
                print_status "Installing bundler..."
                gem install bundler
            fi
            
            # Install Jekyll dependencies
            if [ -f "Gemfile" ]; then
                print_status "Installing Jekyll dependencies..."
                bundle install
            fi
        else
            print_warning "Ruby not found. Jekyll setup skipped."
            print_status "You can still use GitHub Pages for deployment."
        fi
    fi
}

# Create necessary directories
setup_directories() {
    print_header "Setting up Project Directories"
    
    mkdir -p data
    mkdir -p logs
    mkdir -p scripts
    mkdir -p _site
    
    print_status "Created project directories"
}

# Setup Python data collector
setup_data_collector() {
    print_header "Setting up SLURM Data Collector"
    
    # Make the collector executable
    if [ -f "scripts/slurm_data_collector.py" ]; then
        chmod +x scripts/slurm_data_collector.py
        print_status "Made data collector executable"
        
        # Test the collector
        print_status "Testing data collector..."
        if python scripts/slurm_data_collector.py --help > /dev/null 2>&1; then
            print_status "Data collector test passed"
        else
            print_warning "Data collector test failed - check dependencies"
        fi
    fi
}

# Setup cron job (optional)
setup_cron() {
    print_header "Setting up Data Collection Cron Job (Optional)"
    
    read -p "Do you want to set up automatic data collection? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        SCRIPT_PATH="$(pwd)/scripts/slurm_data_collector.py"
        DATA_PATH="$(pwd)/data/cluster_status.json"
        
        # Create cron job entry
        CRON_ENTRY="*/1 * * * * cd $(pwd) && conda run -n nexus-cluster-status python $SCRIPT_PATH --output $DATA_PATH --pretty"
        
        print_status "Adding cron job to collect data every minute..."
        (crontab -l 2>/dev/null; echo "$CRON_ENTRY") | crontab -
        
        print_status "Cron job added. Data will be collected to: $DATA_PATH"
        print_warning "Make sure your SLURM commands work from cron environment"
    fi
}

# Create a simple API server
create_api_server() {
    print_header "Creating Simple API Server"
    
    cat > scripts/api_server.py << 'EOF'
#!/usr/bin/env python3
"""
Simple Flask API server for serving cluster data
"""

import json
import os
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from datetime import datetime

app = Flask(__name__)
CORS(app)  # Enable CORS for GitHub Pages

DATA_FILE = os.path.join(os.path.dirname(__file__), '..', 'data', 'cluster_status.json')

@app.route('/api/cluster-status')
def get_cluster_status():
    """Return the latest cluster status."""
    try:
        if os.path.exists(DATA_FILE):
            with open(DATA_FILE, 'r') as f:
                data = json.load(f)
            return jsonify(data)
        else:
            # Return mock data if no data file exists
            return jsonify({
                'timestamp': datetime.now().isoformat(),
                'nodes': [],
                'partitions': {},
                'error': 'No data file found'
            })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/health')
def health_check():
    """Health check endpoint."""
    return jsonify({'status': 'healthy', 'timestamp': datetime.now().isoformat()})

if __name__ == '__main__':
    print(f"Serving cluster data from: {DATA_FILE}")
    app.run(host='0.0.0.0', port=5000, debug=True)
EOF
    
    chmod +x scripts/api_server.py
    print_status "Created API server at scripts/api_server.py"
}

# Main setup function
main() {
    print_header "Nexus Cluster Status Dashboard Setup"
    
    # Check prerequisites
    check_conda
    
    # Setup conda environment
    setup_conda_env
    
    # Setup directories
    setup_directories
    
    # Setup components
    setup_data_collector
    create_api_server
    setup_jekyll
    setup_cron
    
    print_header "Setup Complete!"
    print_status "Next steps:"
    echo "  1. Activate the environment: conda activate nexus-cluster-status"
    echo "  2. Test data collection: python scripts/slurm_data_collector.py --pretty"
    echo "  3. Start API server: python scripts/api_server.py"
    echo "  4. For Jekyll: bundle exec jekyll serve (if installed)"
    echo "  5. Push to GitHub for Pages deployment"
    echo ""
    print_status "Environment setup complete! 🎉"
}

# Run main function
main "$@"