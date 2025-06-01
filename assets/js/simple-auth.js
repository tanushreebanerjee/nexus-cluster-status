/**
 * Simple Token-Based Authentication
 * Simpler alternative to GitHub OAuth for GitHub Pages
 */

class SimpleAuth {
    constructor(config) {
        this.validTokens = config.validTokens || [];
        this.sessionDuration = config.sessionDuration || 24 * 60 * 60 * 1000; // 24 hours
        this.storageKey = 'nexus_auth_token';
        this.sessionKey = 'nexus_auth_session';
        
        this.init();
    }
    
    init() {
        if (this.isAuthenticated()) {
            this.showDashboard();
        } else {
            this.showLoginUI();
        }
    }
    
    isAuthenticated() {
        const session = this.getSession();
        if (!session) return false;
        
        // Check if session is expired
        if (Date.now() > session.expiry) {
            this.logout();
            return false;
        }
        
        return this.validTokens.includes(session.token);
    }
    
    getSession() {
        try {
            return JSON.parse(localStorage.getItem(this.sessionKey));
        } catch {
            return null;
        }
    }
    
    setSession(token) {
        const session = {
            token: token,
            expiry: Date.now() + this.sessionDuration,
            loginTime: Date.now()
        };
        localStorage.setItem(this.sessionKey, JSON.stringify(session));
    }
    
    authenticate(token) {
        if (this.validTokens.includes(token)) {
            this.setSession(token);
            this.showDashboard();
            return true;
        }
        return false;
    }
    
    logout() {
        localStorage.removeItem(this.sessionKey);
        this.showLoginUI();
    }
    
    showLoginUI() {
        document.body.innerHTML = `
            <div class="auth-container">
                <div class="auth-card">
                    <div class="auth-header">
                        <h1>🔐 Nexus Cluster Access</h1>
                        <p>Enter your access token to continue</p>
                    </div>
                    <div class="auth-content">
                        <form id="token-form">
                            <input 
                                type="password" 
                                id="access-token" 
                                class="token-input" 
                                placeholder="Enter access token..."
                                autocomplete="current-password"
                                required
                            >
                            <div id="auth-error" class="auth-error" style="display: none;"></div>
                            <button type="submit" class="login-btn">
                                <span id="login-text">Access Dashboard</span>
                                <span id="login-loading" class="auth-loading" style="display: none;"></span>
                            </button>
                        </form>
                    </div>
                    <div class="auth-footer">
                        <p><small>Authorized users only • UMIACS Nexus Cluster</small></p>
                    </div>
                </div>
            </div>
        `;
        
        const form = document.getElementById('token-form');
        const tokenInput = document.getElementById('access-token');
        const errorDiv = document.getElementById('auth-error');
        const loginText = document.getElementById('login-text');
        const loginLoading = document.getElementById('login-loading');
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const token = tokenInput.value.trim();
            if (!token) return;
            
            // Show loading state
            loginText.style.display = 'none';
            loginLoading.style.display = 'inline-block';
            errorDiv.style.display = 'none';
            
            // Simulate API call delay
            await new Promise(resolve => setTimeout(resolve, 500));
            
            if (this.authenticate(token)) {
                // Success - dashboard will be shown by authenticate()
            } else {
                // Show error
                errorDiv.textContent = 'Invalid access token. Please try again.';
                errorDiv.style.display = 'block';
                
                // Reset form
                tokenInput.value = '';
                loginText.style.display = 'inline';
                loginLoading.style.display = 'none';
                
                // Shake animation for error feedback
                tokenInput.style.animation = 'shake 0.5s ease-in-out';
                setTimeout(() => {
                    tokenInput.style.animation = '';
                }, 500);
            }
        });
        
        // Focus the input
        tokenInput.focus();
        
        // Add shake animation CSS
        if (!document.getElementById('shake-css')) {
            const style = document.createElement('style');
            style.id = 'shake-css';
            style.textContent = `
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-5px); }
                    75% { transform: translateX(5px); }
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    showDashboard() {
        const session = this.getSession();
        const timeRemaining = Math.round((session.expiry - Date.now()) / (1000 * 60 * 60)); // hours
        
        document.body.innerHTML = `
            <div class="auth-header-bar">
                <span class="user-info">
                    <span class="auth-status connected"></span>
                    Authenticated • ${timeRemaining}h remaining
                </span>
                <button id="logout-btn" class="logout-btn">Logout</button>
            </div>
            <div id="main-dashboard">
                <!-- Main dashboard content will be loaded here -->
            </div>
        `;
        
        document.getElementById('logout-btn').addEventListener('click', () => this.logout());
        
        // Load the main dashboard
        this.loadDashboard();
    }
    
    async loadDashboard() {
        const dashboardHTML = `
            <div class="cluster-status">
                <div class="header-info">
                    <span id="last-updated">Updated 2025/Jun/1 0:20:12 (71 seconds ago).</span>
                    <span class="status-message">If the site is down, I already know. Only ping me if the info here is incorrect.</span>
                    <span class="refresh-info">
                        <a href="#" id="refresh-link">Refresh</a> in <span id="countdown">10</span> seconds!
                    </span>
                </div>

                <div class="partition-selector">
                    <label for="partition-select">Select Partition:</label>
                    <select id="partition-select">
                        <option value="all">All Partitions</option>
                        <option value="pci">PCI Partition</option>
                        <option value="tron">Tron Partition</option>
                        <option value="scavenger">Scavenger Partition</option>
                        <option value="cbcb">CBCB Partition</option>
                        <option value="clip">CLIP Partition</option>
                    </select>
                </div>

                <div id="cluster-data">
                    <!-- Node overview section -->
                    <div class="nodes-overview" id="nodes-overview">
                        <table class="nodes-table">
                            <thead>
                                <tr>
                                    <th>Node</th>
                                    <th>Available CPU</th>
                                    <th>Available GPU</th>
                                    <th>Unrequested Mem</th>
                                    <th>Actual Free Mem</th>
                                </tr>
                            </thead>
                            <tbody id="nodes-tbody">
                                <!-- Nodes will be populated by JavaScript -->
                            </tbody>
                        </table>
                    </div>

                    <!-- Partition sections -->
                    <div id="partitions-container">
                        <!-- Partitions will be populated by JavaScript -->
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('main-dashboard').innerHTML = dashboardHTML;
        
        // Initialize dashboard functionality
        if (window.initializeDashboard) {
            window.initializeDashboard();
        } else {
            // Load dashboard script if not already loaded
            this.loadDashboardScript();
        }
    }
    
    loadDashboardScript() {
        // Load the original dashboard functionality
        const script = document.createElement('script');
        script.src = '/assets/js/dashboard.js';
        script.onload = () => {
            if (window.initializeDashboard) {
                window.initializeDashboard();
            }
        };
        document.head.appendChild(script);
    }
    
    // Method to extend session
    extendSession() {
        const session = this.getSession();
        if (session) {
            session.expiry = Date.now() + this.sessionDuration;
            localStorage.setItem(this.sessionKey, JSON.stringify(session));
        }
    }
    
    // Method to get remaining session time
    getSessionTimeRemaining() {
        const session = this.getSession();
        if (!session) return 0;
        return Math.max(0, session.expiry - Date.now());
    }
    
    // Auto-logout warning
    startSessionMonitoring() {
        setInterval(() => {
            const timeRemaining = this.getSessionTimeRemaining();
            
            // Warn when 30 minutes remaining
            if (timeRemaining <= 30 * 60 * 1000 && timeRemaining > 29 * 60 * 1000) {
                this.showSessionWarning(30);
            }
            
            // Warn when 5 minutes remaining
            if (timeRemaining <= 5 * 60 * 1000 && timeRemaining > 4 * 60 * 1000) {
                this.showSessionWarning(5);
            }
            
            // Auto-logout when expired
            if (timeRemaining <= 0) {
                this.logout();
            }
        }, 60000); // Check every minute
    }
    
    showSessionWarning(minutes) {
        const warningDiv = document.createElement('div');
        warningDiv.className = 'session-warning';
        warningDiv.innerHTML = `
            <div class="warning-content">
                <span>⚠️ Your session will expire in ${minutes} minutes</span>
                <button onclick="this.parentElement.parentElement.remove()">✕</button>
            </div>
        `;
        
        // Add warning styles if not already present
        if (!document.getElementById('warning-css')) {
            const style = document.createElement('style');
            style.id = 'warning-css';
            style.textContent = `
                .session-warning {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: #ffaa00;
                    color: #000;
                    padding: 10px;
                    border-radius: 5px;
                    box-shadow: 0 4px 12px rgba(255, 170, 0, 0.3);
                    z-index: 10000;
                    animation: slideIn 0.3s ease-out;
                }
                
                .warning-content {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-size: 12px;
                    font-weight: bold;
                }
                
                .warning-content button {
                    background: none;
                    border: none;
                    color: #000;
                    cursor: pointer;
                    font-size: 14px;
                    padding: 0;
                    width: 20px;
                    height: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                @keyframes slideIn {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(warningDiv);
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (warningDiv.parentElement) {
                warningDiv.remove();
            }
        }, 10000);
    }
}

// Enhanced Token Generator for Admins
class TokenGenerator {
    static generateSecureToken(length = 32) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
    
    static generateDateBasedToken(prefix = 'nexus') {
        const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const random = this.generateSecureToken(8);
        return `${prefix}-${date}-${random}`;
    }
    
    static generateUserToken(username, role = 'user') {
        const random = this.generateSecureToken(16);
        return `${role}-${username}-${random}`;
    }
}

// Export for use in other scripts
window.SimpleAuth = SimpleAuth;
window.TokenGenerator = TokenGenerator;