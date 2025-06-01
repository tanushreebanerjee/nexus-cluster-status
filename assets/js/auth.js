/**
 * GitHub OAuth Authentication for Nexus Cluster Dashboard
 * Client-side authentication compatible with GitHub Pages
 */

class GitHubAuth {
    constructor(config) {
        this.clientId = config.clientId;
        this.redirectUri = config.redirectUri || window.location.origin;
        this.allowedUsers = config.allowedUsers || [];
        this.allowedOrgs = config.allowedOrgs || [];
        this.requiredScope = config.scope || 'read:user read:org';
        
        this.accessToken = localStorage.getItem('github_access_token');
        this.userInfo = JSON.parse(localStorage.getItem('github_user_info') || 'null');
        
        this.init();
    }
    
    init() {
        // Check if returning from OAuth
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        
        if (code && state === localStorage.getItem('oauth_state')) {
            this.handleOAuthCallback(code);
        } else if (!this.isAuthenticated()) {
            this.showLoginUI();
        } else {
            this.validateAndLoadUser();
        }
    }
    
    isAuthenticated() {
        return this.accessToken && this.userInfo;
    }
    
    async validateAndLoadUser() {
        if (!this.accessToken) {
            this.showLoginUI();
            return;
        }
        
        try {
            // Validate token and get fresh user info
            const userInfo = await this.fetchUserInfo();
            const isAuthorized = await this.checkAuthorization(userInfo);
            
            if (isAuthorized) {
                this.userInfo = userInfo;
                localStorage.setItem('github_user_info', JSON.stringify(userInfo));
                this.showDashboard();
            } else {
                this.showUnauthorized();
            }
        } catch (error) {
            console.error('Authentication validation failed:', error);
            this.logout();
        }
    }
    
    generateState() {
        return Math.random().toString(36).substring(2, 15) + 
               Math.random().toString(36).substring(2, 15);
    }
    
    login() {
        const state = this.generateState();
        localStorage.setItem('oauth_state', state);
        
        const params = new URLSearchParams({
            client_id: this.clientId,
            redirect_uri: this.redirectUri,
            scope: this.requiredScope,
            state: state,
            allow_signup: 'false'
        });
        
        window.location.href = `https://github.com/login/oauth/authorize?${params}`;
    }
    
    async handleOAuthCallback(code) {
        try {
            // Exchange code for access token using GitHub's device flow or a proxy
            const token = await this.exchangeCodeForToken(code);
            
            if (token) {
                this.accessToken = token;
                localStorage.setItem('github_access_token', token);
                
                // Clean up URL
                window.history.replaceState({}, document.title, window.location.pathname);
                
                await this.validateAndLoadUser();
            } else {
                throw new Error('Failed to exchange code for token');
            }
        } catch (error) {
            console.error('OAuth callback failed:', error);
            this.showError('Authentication failed. Please try again.');
        }
    }
    
    async exchangeCodeForToken(code) {
        // Since GitHub Pages can't handle server-side OAuth, we need to use a proxy
        // Option 1: Use a serverless function (Netlify/Vercel)
        // Option 2: Use a CORS-enabled proxy service
        // Option 3: Use GitHub's device flow (recommended)
        
        try {
            // Using a CORS proxy for the token exchange
            const response = await fetch('https://cors-anywhere.herokuapp.com/https://github.com/login/oauth/access_token', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    client_id: this.clientId,
                    client_secret: this.clientSecret, // Note: This should be in a serverless function
                    code: code
                })
            });
            
            const data = await response.json();
            return data.access_token;
        } catch (error) {
            console.error('Token exchange failed:', error);
            throw error;
        }
    }
    
    async fetchUserInfo() {
        const response = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `token ${this.accessToken}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch user info');
        }
        
        return await response.json();
    }
    
    async fetchUserOrgs() {
        const response = await fetch('https://api.github.com/user/orgs', {
            headers: {
                'Authorization': `token ${this.accessToken}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch user organizations');
        }
        
        return await response.json();
    }
    
    async checkAuthorization(userInfo) {
        // Check if user is in allowed users list
        if (this.allowedUsers.length > 0) {
            const isAllowedUser = this.allowedUsers.includes(userInfo.login.toLowerCase());
            if (isAllowedUser) return true;
        }
        
        // Check if user is in allowed organizations
        if (this.allowedOrgs.length > 0) {
            try {
                const orgs = await this.fetchUserOrgs();
                const userOrgLogins = orgs.map(org => org.login.toLowerCase());
                const hasAllowedOrg = this.allowedOrgs.some(allowedOrg => 
                    userOrgLogins.includes(allowedOrg.toLowerCase())
                );
                if (hasAllowedOrg) return true;
            } catch (error) {
                console.error('Failed to check user organizations:', error);
            }
        }
        
        // If no restrictions are set, allow all authenticated users
        if (this.allowedUsers.length === 0 && this.allowedOrgs.length === 0) {
            return true;
        }
        
        return false;
    }
    
    logout() {
        localStorage.removeItem('github_access_token');
        localStorage.removeItem('github_user_info');
        localStorage.removeItem('oauth_state');
        
        this.accessToken = null;
        this.userInfo = null;
        
        this.showLoginUI();
    }
    
    showLoginUI() {
        document.body.innerHTML = `
            <div class="auth-container">
                <div class="auth-card">
                    <div class="auth-header">
                        <h1>🔐 Nexus Cluster Access</h1>
                        <p>Please authenticate to view cluster status</p>
                    </div>
                    <div class="auth-content">
                        <p>This dashboard shows sensitive cluster information and requires authentication.</p>
                        <button id="github-login-btn" class="login-btn">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                            </svg>
                            Sign in with GitHub
                        </button>
                    </div>
                    <div class="auth-footer">
                        <p><small>Authorized users only • UMIACS Nexus Cluster</small></p>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('github-login-btn').addEventListener('click', () => this.login());
    }
    
    showDashboard() {
        // Remove auth UI and show the main dashboard
        document.body.innerHTML = `
            <div class="auth-header-bar">
                <span class="user-info">
                    <img src="${this.userInfo.avatar_url}" alt="Avatar" class="user-avatar">
                    Welcome, ${this.userInfo.name || this.userInfo.login}
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
    
    showUnauthorized() {
        document.body.innerHTML = `
            <div class="auth-container">
                <div class="auth-card error">
                    <div class="auth-header">
                        <h1>🚫 Access Denied</h1>
                        <p>You are not authorized to view this dashboard</p>
                    </div>
                    <div class="auth-content">
                        <p>This resource is restricted to authorized UMIACS users only.</p>
                        <p>If you believe you should have access, please contact your system administrator.</p>
                        <button id="logout-btn" class="logout-btn">Try Different Account</button>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('logout-btn').addEventListener('click', () => this.logout());
    }
    
    showError(message) {
        document.body.innerHTML = `
            <div class="auth-container">
                <div class="auth-card error">
                    <div class="auth-header">
                        <h1>⚠️ Authentication Error</h1>
                        <p>${message}</p>
                    </div>
                    <div class="auth-content">
                        <button id="retry-btn" class="login-btn">Try Again</button>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('retry-btn').addEventListener('click', () => this.showLoginUI());
    }
    
    async loadDashboard() {
        // Load the original dashboard content
        try {
            const dashboardResponse = await fetch('/dashboard.html');
            const dashboardHTML = await dashboardResponse.text();
            document.getElementById('main-dashboard').innerHTML = dashboardHTML;
            
            // Initialize dashboard JavaScript
            if (window.initializeDashboard) {
                window.initializeDashboard();
            }
        } catch (error) {
            console.error('Failed to load dashboard:', error);
            document.getElementById('main-dashboard').innerHTML = '<p>Error loading dashboard</p>';
        }
    }
    
    // Utility method to get current user info
    getCurrentUser() {
        return this.userInfo;
    }
    
    // Method to check if current user has specific permissions
    hasPermission(permission) {
        // Implement custom permission logic here
        return true; // For now, all authenticated users have all permissions
    }
}

// Export for use in other scripts
window.GitHubAuth = GitHubAuth;