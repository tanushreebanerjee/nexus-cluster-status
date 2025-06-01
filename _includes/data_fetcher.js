// Data fetcher for UMD Nexus cluster status
class NexusDataFetcher {
    constructor(apiEndpoint = '/api/cluster-status') {
        this.apiEndpoint = apiEndpoint;
        this.lastUpdate = null;
        this.refreshInterval = 10000; // 10 seconds
        this.retryAttempts = 3;
    }

    // Fetch cluster data from API or static JSON
    async fetchClusterData() {
        try {
            const response = await fetch(this.apiEndpoint);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            this.lastUpdate = new Date();
            return this.processClusterData(data);
        } catch (error) {
            console.warn('API fetch failed, falling back to mock data:', error);
            return this.getMockData();
        }
    }

    // Process raw cluster data into display format
    processClusterData(rawData) {
        return {
            lastUpdated: rawData.timestamp || new Date().toISOString(),
            nodes: this.processNodes(rawData.nodes || []),
            partitions: this.processPartitions(rawData.partitions || {})
        };
    }

    // Process node data
    processNodes(nodes) {
        return nodes.map(node => ({
            name: node.NodeName,
            cpu: `${node.AllocCPUs || 0}/${node.CPUTot || 0}`,
            gpu: `${node.AllocGRES ? this.parseGRES(node.AllocGRES).gpu : 0}/${node.TotalGRES ? this.parseGRES(node.TotalGRES).gpu : 0}`,
            unreqMem: this.formatMemory(node.FreeMem || 0),
            freeMem: this.formatMemory(node.RealMemory - (node.AllocMem || 0)),
            status: node.State || 'unknown',
            type: this.getNodeType(node.Gres || '')
        }));
    }

    // Process partition data
    processPartitions(partitions) {
        const processed = {};
        
        Object.keys(partitions).forEach(partitionName => {
            const partition = partitions[partitionName];
            processed[partitionName] = {
                users: this.processUsers(partition.users || [], partition.currentUser)
            };
        });

        return processed;
    }

    // Process user data within partitions
    processUsers(users, currentUser) {
        return users.map(user => ({
            name: user.name,
            isCurrentUser: user.name === currentUser,
            jobs: user.jobs.map(job => ({
                node: job.node,
                cpu: this.formatResourceUsage(job.cpu, job.cpuTotal),
                gpu: this.formatResourceUsage(job.gpu, job.gpuTotal),
                mem: this.formatMemoryUsage(job.mem, job.memTotal)
            })),
            total: {
                cpu: this.formatResourceUsage(user.totalCpu, user.totalCpuAvailable),
                gpu: this.formatResourceUsage(user.totalGpu, user.totalGpuAvailable),
                mem: this.formatMemoryUsage(user.totalMem, user.totalMemAvailable)
            }
        }));
    }

    // Utility functions
    parseGRES(gresString) {
        const gpu = (gresString.match(/gpu:(\d+)/) || [0, 0])[1];
        return { gpu: parseInt(gpu) };
    }

    formatMemory(bytes) {
        if (bytes >= 1024 * 1024 * 1024) {
            return Math.round(bytes / (1024 * 1024 * 1024)) + 'G';
        } else if (bytes >= 1024 * 1024) {
            return Math.round(bytes / (1024 * 1024)) + 'M';
        }
        return bytes + 'B';
    }

    formatResourceUsage(used, total) {
        const percentage = total > 0 ? Math.round((used / total) * 100) : 0;
        return `${used} (${percentage}%)`;
    }

    formatMemoryUsage(used, total) {
        const usedFormatted = this.formatMemory(used);
        const percentage = total > 0 ? Math.round((used / total) * 100) : 0;
        return `${usedFormatted} (${percentage}%)`;
    }

    getNodeType(gresString) {
        if (gresString.includes('a6000')) return 'A6000';
        if (gresString.includes('rtx2080ti')) return 'RTX 2080 Ti';
        if (gresString.includes('v100')) return 'V100';
        return 'Unknown';
    }

    // Mock data for development/fallback
    getMockData() {
        return {
            lastUpdated: new Date().toISOString(),
            nodes: [
                { name: "node209", cpu: "0/104", gpu: "0/10", unreqMem: "402G", freeMem: "28G", status: "draining", type: "A6000" },
                { name: "node300", cpu: "0/104", gpu: "0/10", unreqMem: "403G", freeMem: "6G", status: "draining", type: "A6000" },
                { name: "node301", cpu: "0/104", gpu: "0/10", unreqMem: "403G", freeMem: "36G", status: "draining", type: "A6000" }
            ],
            partitions: {
                pci: {
                    users: [
                        {
                            name: "tb21 (Tanushree Banerjee)",
                            isCurrentUser: true,
                            jobs: [
                                { node: "node209", cpu: "20 (19%)", gpu: "10 (100%)", mem: "100G (20%)" },
                                { node: "node300", cpu: "20 (19%)", gpu: "10 (100%)", mem: "100G (20%)" },
                                { node: "node301", cpu: "20 (19%)", gpu: "10 (100%)", mem: "100G (20%)" }
                            ],
                            total: { cpu: "60 (1%)", gpu: "30 (4%)", mem: "300G (1%)" }
                        }
                    ]
                },
                pnlp: {
                    users: [
                        {
                            name: "cj7280",
                            isCurrentUser: false,
                            jobs: [
                                { node: "node012", cpu: "10 (16%)", gpu: "1 (13%)", mem: "100G (27%)" },
                                { node: "node806", cpu: "10 (25%)", gpu: "1 (10%)", mem: "100G (40%)" }
                            ],
                            total: { cpu: "20 (0%)", gpu: "2 (0%)", mem: "200G (1%)" }
                        }
                    ]
                }
            }
        };
    }

    // Auto-refresh functionality
    startAutoRefresh(callback) {
        setInterval(async () => {
            try {
                const data = await this.fetchClusterData();
                callback(data);
            } catch (error) {
                console.error('Auto-refresh failed:', error);
            }
        }, this.refreshInterval);
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NexusDataFetcher;
} else {
    window.NexusDataFetcher = NexusDataFetcher;
}