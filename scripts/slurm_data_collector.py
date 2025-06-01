#!/usr/bin/env python3
"""
SLURM Data Collector for Nexus Cluster Status Dashboard

This script collects cluster information from SLURM and outputs JSON
that can be consumed by the Jekyll-based status dashboard.
"""

import json
import subprocess
import sys
import re
from datetime import datetime
from typing import Dict, List, Any
import argparse


class SlurmDataCollector:
    def __init__(self, current_user: str = None):
        self.current_user = current_user or self.get_current_user()
        
    def get_current_user(self) -> str:
        """Get the current username."""
        try:
            result = subprocess.run(['whoami'], capture_output=True, text=True, check=True)
            return result.stdout.strip()
        except subprocess.CalledProcessError:
            return "unknown"
    
    def run_command(self, command: List[str]) -> str:
        """Run a shell command and return output."""
        try:
            result = subprocess.run(command, capture_output=True, text=True, check=True)
            return result.stdout.strip()
        except subprocess.CalledProcessError as e:
            print(f"Error running command {' '.join(command)}: {e}", file=sys.stderr)
            return ""
    
    def collect_node_data(self) -> List[Dict[str, Any]]:
        """Collect node information from SLURM."""
        nodes = []
        
        # Get node information
        node_output = self.run_command([
            'sinfo', '-N', '-h', '-o', 
            '%N|%C|%G|%m|%T|%f'
        ])
        
        for line in node_output.split('\n'):
            if not line.strip():
                continue
                
            parts = line.split('|')
            if len(parts) >= 6:
                node_name = parts[0].strip()
                cpu_info = parts[1].strip()  # Format: allocated/idle/other/total
                gres_info = parts[2].strip()
                memory = parts[3].strip()
                state = parts[4].strip()
                features = parts[5].strip()
                
                # Parse CPU information
                cpu_parts = cpu_info.split('/')
                alloc_cpus = int(cpu_parts[0]) if len(cpu_parts) > 0 else 0
                total_cpus = int(cpu_parts[3]) if len(cpu_parts) > 3 else 0
                
                # Parse GRES (GPU) information
                gpu_total = 0
                gpu_alloc = 0
                gpu_type = "unknown"
                
                if gres_info and gres_info != "(null)":
                    gpu_match = re.search(r'gpu:(\w+):(\d+)', gres_info)
                    if gpu_match:
                        gpu_type = gpu_match.group(1)
                        gpu_total = int(gpu_match.group(2))
                
                # Get allocated GPUs for this node
                gpu_alloc = self.get_allocated_gpus(node_name)
                
                nodes.append({
                    'NodeName': node_name,
                    'CPUTot': total_cpus,
                    'AllocCPUs': alloc_cpus,
                    'TotalGRES': f"gpu:{gpu_type}:{gpu_total}" if gpu_total > 0 else "",
                    'AllocGRES': f"gpu:{gpu_alloc}" if gpu_alloc > 0 else "",
                    'RealMemory': int(memory) * 1024 * 1024 if memory.isdigit() else 0,  # Convert MB to bytes
                    'AllocMem': 0,  # Will be calculated from job data
                    'FreeMem': int(memory) * 1024 * 1024 if memory.isdigit() else 0,
                    'State': state,
                    'Features': features
                })
        
        return nodes
    
    def get_allocated_gpus(self, node_name: str) -> int:
        """Get number of allocated GPUs for a specific node."""
        job_output = self.run_command([
            'squeue', '-h', '-w', node_name, '-o', '%b'
        ])
        
        total_gpus = 0
        for line in job_output.split('\n'):
            if 'gpu:' in line:
                gpu_match = re.search(r'gpu:(\d+)', line)
                if gpu_match:
                    total_gpus += int(gpu_match.group(1))
        
        return total_gpus
    
    def collect_partition_data(self) -> Dict[str, Any]:
        """Collect partition and job information."""
        partitions = {}
        
        # Get job information
        job_output = self.run_command([
            'squeue', '-h', '-o', 
            '%i|%j|%u|%P|%t|%M|%D|%C|%m|%N|%b|%a'
        ])
        
        for line in job_output.split('\n'):
            if not line.strip():
                continue
                
            parts = line.split('|')
            if len(parts) >= 12:
                job_id = parts[0].strip()
                job_name = parts[1].strip()
                user = parts[2].strip()
                partition = parts[3].strip()
                state = parts[4].strip()
                time = parts[5].strip()
                nodes_count = parts[6].strip()
                cpus = parts[7].strip()
                memory = parts[8].strip()
                nodelist = parts[9].strip()
                gres = parts[10].strip()
                account = parts[11].strip()
                
                # Skip non-running jobs
                if state != 'R':
                    continue
                
                # Initialize partition if not exists
                if partition not in partitions:
                    partitions[partition] = {
                        'currentUser': self.current_user,
                        'users': {}
                    }
                
                # Initialize user if not exists
                if user not in partitions[partition]['users']:
                    partitions[partition]['users'][user] = {
                        'name': user,
                        'jobs': [],
                        'totalCpu': 0,
                        'totalGpu': 0,
                        'totalMem': 0
                    }
                
                # Parse resource requirements
                cpu_count = int(cpus) if cpus.isdigit() else 0
                mem_bytes = self.parse_memory(memory)
                gpu_count = self.parse_gpu_gres(gres)
                
                # Add job to user
                for node in nodelist.split(','):
                    node = node.strip()
                    if node:
                        partitions[partition]['users'][user]['jobs'].append({
                            'node': node,
                            'cpu': cpu_count,
                            'cpuTotal': self.get_node_cpu_total(node),
                            'gpu': gpu_count,
                            'gpuTotal': self.get_node_gpu_total(node),
                            'mem': mem_bytes,
                            'memTotal': self.get_node_mem_total(node)
                        })
                
                # Update user totals
                partitions[partition]['users'][user]['totalCpu'] += cpu_count
                partitions[partition]['users'][user]['totalGpu'] += gpu_count
                partitions[partition]['users'][user]['totalMem'] += mem_bytes
        
        # Convert users dict to list and add totals
        for partition_name in partitions:
            user_list = []
            for user_name, user_data in partitions[partition_name]['users'].items():
                user_data['totalCpuAvailable'] = 10000  # Placeholder - calculate from partition limits
                user_data['totalGpuAvailable'] = 1000   # Placeholder
                user_data['totalMemAvailable'] = user_data['totalMem'] * 100  # Placeholder
                user_list.append(user_data)
            
            partitions[partition_name]['users'] = user_list
        
        return partitions
    
    def parse_memory(self, memory_str: str) -> int:
        """Parse memory string to bytes."""
        if not memory_str or memory_str == 'N/A':
            return 0
        
        # Remove units and convert
        memory_str = memory_str.upper().replace('G', '').replace('M', '').replace('K', '')
        
        try:
            if 'G' in memory_str:
                return int(float(memory_str) * 1024 * 1024 * 1024)
            elif 'M' in memory_str:
                return int(float(memory_str) * 1024 * 1024)
            elif 'K' in memory_str:
                return int(float(memory_str) * 1024)
            else:
                return int(float(memory_str))
        except (ValueError, TypeError):
            return 0
    
    def parse_gpu_gres(self, gres_str: str) -> int:
        """Parse GPU count from GRES string."""
        if not gres_str or gres_str == 'N/A':
            return 0
        
        gpu_match = re.search(r'gpu:(\d+)', gres_str)
        return int(gpu_match.group(1)) if gpu_match else 0
    
    def get_node_cpu_total(self, node_name: str) -> int:
        """Get total CPU count for a node."""
        # This would typically be cached or looked up from node data
        return 104  # Default for A6000 nodes
    
    def get_node_gpu_total(self, node_name: str) -> int:
        """Get total GPU count for a node."""
        return 10  # Default for A6000 nodes
    
    def get_node_mem_total(self, node_name: str) -> int:
        """Get total memory for a node in bytes."""
        return 540 * 1024 * 1024 * 1024  # 540GB default
    
    def collect_all_data(self) -> Dict[str, Any]:
        """Collect all cluster data."""
        return {
            'timestamp': datetime.now().isoformat(),
            'nodes': self.collect_node_data(),
            'partitions': self.collect_partition_data()
        }


def main():
    parser = argparse.ArgumentParser(description='Collect SLURM cluster data')
    parser.add_argument('--user', help='Current user name (auto-detected if not provided)')
    parser.add_argument('--output', '-o', help='Output file (stdout if not provided)')
    parser.add_argument('--pretty', action='store_true', help='Pretty print JSON')
    
    args = parser.parse_args()
    
    collector = SlurmDataCollector(current_user=args.user)
    data = collector.collect_all_data()
    
    json_output = json.dumps(data, indent=2 if args.pretty else None)
    
    if args.output:
        with open(args.output, 'w') as f:
            f.write(json_output)
        print(f"Data written to {args.output}")
    else:
        print(json_output)


if __name__ == '__main__':
    main()