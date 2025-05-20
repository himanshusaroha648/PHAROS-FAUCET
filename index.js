const { ethers } = require('ethers');
const axios = require('axios');
const FakeUserAgent = require('fake-useragent');
const fs = require('fs');
const readline = require('readline');
const chalk = require('chalk').default;

const BASE_API = "https://api.pharosnetwork.xyz";
const RPC_URL = "https://testnet.dplabs-internal.com";
const REF_CODE = "LtDCunijXTOizRry";

class PharosTestnet {
    constructor() {
        this.headers = {
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
            "Origin": "https://testnet.pharosnetwork.xyz",
            "Referer": "https://testnet.pharosnetwork.xyz/",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-site",
            "User-Agent": new FakeUserAgent().random
        };
        this.successfulClaims = 0;
        this.failedClaims = 0;
        
        // Initialize provider with network configuration
        this.provider = new ethers.JsonRpcProvider(RPC_URL, {
            chainId: 688688,
            name: "pharos-testnet"
        });
    }

    clearTerminal() {
        console.clear();
    }

    log(message) {
        const now = new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' });
        console.log(chalk.cyan(`[ ${now} ] | ${message}`));
    }

    welcome() {
        console.log(chalk.yellow('=========================================='));
        console.log(chalk.yellow('           PHAROS  FAUCET'));
        console.log(chalk.yellow('=========================================='));
        console.log(chalk.green('Developed by: HIMANSHU SAROHA'));
        console.log(chalk.cyan('Bot: PHAROS-FAUCET'));
    }

    async askQuestion(question) {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const answer = await new Promise((resolve) => {
            rl.question(question, (answer) => {
                rl.close();
                resolve(answer);
            });
        });

        return answer;
    }

    async generateWallets() {
        while (true) {
            const numWallets = parseInt(await this.askQuestion("How many wallets do you want to create? -> "));
            if (numWallets > 0) {
                const wallets = [];
                for (let i = 0; i < numWallets; i++) {
                    const wallet = ethers.Wallet.createRandom();
                    wallets.push(wallet.privateKey);
                }

                // Check if accounts.txt exists and read existing wallets
                let existingWallets = [];
                if (fs.existsSync('accounts.txt')) {
                    existingWallets = fs.readFileSync('accounts.txt', 'utf8').split('\n').filter(Boolean);
                    this.log(`Found ${existingWallets.length} existing wallets`);
                }

                // Combine existing and new wallets
                const allWallets = [...existingWallets, ...wallets];
                
                // Save all wallets
                fs.writeFileSync('accounts.txt', allWallets.join('\n'));
                this.log(`Generated ${numWallets} new wallets`);
                this.log(`Total wallets in accounts.txt: ${allWallets.length}`);
                return;
            }
            console.log("Please enter a positive number.");
        }
    }

    async showMenu() {
        while (true) {
            console.log(chalk.yellow("\nSelect an option:"));
            console.log(chalk.cyan("1. Generate New Wallets"));
            console.log(chalk.cyan("2. Login & Claim Faucet"));
            console.log(chalk.cyan("3. Show All Wallets Balance"));
            console.log(chalk.cyan("4. Transfer Faucet Tokens"));
            console.log(chalk.cyan("5. Claim Faucet in Range"));
            console.log(chalk.cyan("6. Exit"));

            const choice = parseInt(await this.askQuestion(chalk.green("Choose [1-6] -> ")));
            
            switch (choice) {
                case 1:
                    await this.generateWallets();
                    break;
                case 2:
                    await this.loginAndClaimFaucet();
                    break;
                case 3:
                    await this.showAllBalances();
                    break;
                case 4:
                    await this.transferFaucet();
                    break;
                case 5:
                    await this.claimFaucetInRange();
                    break;
                case 6:
                    process.exit(0);
                default:
                    console.log(chalk.red("Invalid choice. Please select 1-6."));
            }
        }
    }

    generateAddress(privateKey) {
        try {
            const wallet = new ethers.Wallet(privateKey);
            return wallet.address;
        } catch (e) {
            return null;
        }
    }

    async generateUrlLogin(privateKey, address) {
        try {
            const wallet = new ethers.Wallet(privateKey);
            const message = "pharos";
            const signature = await wallet.signMessage(message);
            return `${BASE_API}/user/login?address=${address}&signature=${signature}&invite_code=${REF_CODE}`;
        } catch (e) {
            return null;
        }
    }

    maskAccount(account) {
        return `${account.slice(0, 6)}${'*'.repeat(6)}${account.slice(-6)}`;
    }

    async userLogin(urlLogin) {
        const headers = {
            ...this.headers,
            "Authorization": "Bearer null",
            "Content-Length": "0"
        };
        for (let attempt = 0; attempt < 5; attempt++) {
            try {
                const response = await axios.post(urlLogin, null, {
                    headers,
                    timeout: 15000
                });
                return response.data.data.jwt;
            } catch (e) {
                if (attempt < 4) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    continue;
                }
                this.log(chalk.red(`Login error: ${e.message}`));
                return null;
            }
        }
    }

    async faucetStatus(address, token) {
        const url = `${BASE_API}/faucet/status?address=${address}`;
        const headers = {
            ...this.headers,
            "Authorization": `Bearer ${token}`
        };
        for (let attempt = 0; attempt < 5; attempt++) {
            try {
                const response = await axios.get(url, {
                    headers,
                    timeout: 15000
                });
                return response.data;
            } catch (e) {
                if (attempt < 4) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    continue;
                }
                this.log(chalk.red(`Faucet status error: ${e.message}`));
                return null;
            }
        }
    }

    async claimFaucet(address, token, privateKey) {
        try {
            // 1. Sign message
            const wallet = new ethers.Wallet(privateKey);
            const message = "pharos";
            const signature = await wallet.signMessage(message);

            // 2. Login to get JWT
            const loginUrl = `${BASE_API}/user/login?address=${address}&signature=${signature}&invite_code=${REF_CODE}`;
            const headers = {
                accept: "application/json, text/plain, */*",
                "accept-language": "en-US,en;q=0.8",
                authorization: "Bearer null",
                "sec-ch-ua": '"Chromium";v="136", "Brave";v="136", "Not.A/Brand";v="99"',
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": '"Windows"',
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-site",
                "sec-gpc": "1",
                Referer: "https://testnet.pharosnetwork.xyz/",
                "Referrer-Policy": "strict-origin-when-cross-origin",
                "User-Agent": new FakeUserAgent().random,
            };
            this.log(chalk.cyan('Sending login request for faucet...'));
            const loginResponse = await axios({
                method: 'post',
                url: loginUrl,
                headers,
                timeout: 15000
            });
            const loginData = loginResponse.data;
            if (loginData.code !== 0 || !loginData.data || !loginData.data.jwt) {
                this.log(chalk.red(`Login failed for faucet: ${loginData.msg || 'Unknown error or no JWT'}`));
                return { msg: 'error', data: { message: loginData.msg || 'Login failed' } };
            }
            const jwt = loginData.data.jwt;

            // 3. Check faucet status
            const statusUrl = `${BASE_API}/faucet/status?address=${address}`;
            const statusHeaders = {
                ...headers,
                authorization: `Bearer ${jwt}`,
            };
            this.log(chalk.cyan('Checking faucet status...'));
            const statusResponse = await axios({
                method: 'get',
                url: statusUrl,
                headers: statusHeaders,
                timeout: 15000
            });
            const statusData = statusResponse.data;
            if (statusData.code !== 0 || !statusData.data) {
                this.log(chalk.red(`Faucet status check failed: ${statusData.msg || 'Unknown error or no data'}`));
                return { msg: 'error', data: { message: statusData.msg || 'Status check failed' } };
            }
            if (!statusData.data.is_able_to_faucet) {
                const nextAvailable = new Date(statusData.data.avaliable_timestamp * 1000).toLocaleString('en-US', { timeZone: 'Asia/Jakarta' });
                this.log(chalk.yellow(`Faucet: Already Claimed - Available at: ${nextAvailable}`));
                return { msg: 'already_claimed', data: { message: 'Already claimed', avaliable_timestamp: statusData.data.avaliable_timestamp } };
            }

            // 4. Claim faucet using public API
            const claimUrl = `${BASE_API}/faucet/daily?address=${address}`;
            this.log(chalk.cyan('Claiming faucet...'));
            const claimResponse = await axios({
                method: 'post',
                url: claimUrl,
                headers: statusHeaders,
                timeout: 15000
            });
            const claimData = claimResponse.data;
            if (claimData.code === 0) {
                this.log(chalk.green(`Faucet: 0.2 PHRS Claimed Successfully`));
                return { msg: 'ok' };
            } else {
                this.log(chalk.red(`Faucet claim failed: ${claimData.msg || 'Unknown error'}`));
                return { msg: 'error', data: { message: claimData.msg || 'Claim failed' } };
            }
        } catch (error) {
            this.log(chalk.red(`Faucet claim process failed: ${error.message}`));
            if (error.response && error.response.data) {
                this.log(chalk.red(`Faucet API Error: ${JSON.stringify(error.response.data)}`));
            }
            return { msg: 'error', data: { message: error.message } };
        }
    }

    async processAccount(privateKey) {
        const address = this.generateAddress(privateKey);
        if (!address) return;

        const urlLogin = await this.generateUrlLogin(privateKey, address);
        if (!urlLogin) return;

        this.log(`=========================[ ${this.maskAccount(address)} ]=========================`);

        // Retry login up to 3 times
        let token = null;
        let loginRetries = 0;
        while (loginRetries < 3) {
            token = await this.userLogin(urlLogin);
            if (token) {
                this.log("Status: Login Success");
                break;
            } else {
                loginRetries++;
                if (loginRetries < 3) {
                    this.log(chalk.yellow(`Login failed, retrying [${loginRetries}/3]...`));
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            }
        }

        if (!token) {
            this.log(chalk.red("Status: Login Failed after 3 retries"));
            this.failedClaims++;
            return;
        }

        // Wait 3 seconds before claiming faucet
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Check Faucet Status with retries
        let faucetStatus = null;
        let statusRetries = 0;
        while (statusRetries < 3) {
            faucetStatus = await this.faucetStatus(address, token);
            if (faucetStatus?.msg === "ok") {
                break;
            } else {
                statusRetries++;
                if (statusRetries < 3) {
                    this.log(chalk.yellow(`Faucet status check failed, retrying [${statusRetries}/3]...`));
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            }
        }

        if (faucetStatus?.msg === "ok") {
            const isAble = faucetStatus.data?.is_able_to_faucet;

            if (isAble) {
                // Retry logic for claimFaucet
                let claim = null;
                let retries = 0;
                let lastError = null;
                while (retries < 3) {
                    claim = await this.claimFaucet(address, token, privateKey);
                    if (claim?.msg === "ok") {
                        break;
                    } else if (claim?.msg === "error") {
                        // Check if error is related to internal IP
                        if (claim.data?.message?.includes("pharos-1.pharos.testnet.svc.cluster.local") || 
                            claim.data?.message?.includes("192.168.95.170")) {
                            lastError = claim;
                            this.log(chalk.yellow(`Internal IP error, retrying claim [${retries + 1}/3]...`));
                            // Wait longer for internal IP errors
                            await new Promise(resolve => setTimeout(resolve, 8000));
                            retries++;
                            continue;
                        } else if (claim.data?.message?.toLowerCase().includes("transfer token failed")) {
                            lastError = claim;
                            this.log(chalk.yellow(`Faucet: Claim failed, retry [${retries + 1}/3]`));
                            await new Promise(resolve => setTimeout(resolve, 5000));
                            retries++;
                            continue;
                        } else {
                            break;
                        }
                    } else {
                        lastError = claim;
                        this.log(chalk.yellow(`Faucet: Claim failed, retry [${retries + 1}/3]`));
                        await new Promise(resolve => setTimeout(resolve, 5000));
                        retries++;
                    }
                }
                if (claim?.msg === "ok") {
                    this.log(chalk.green("Faucet: 0.2 PHRS Claimed Successfully"));
                    this.successfulClaims++;
                } else if (claim?.msg === "error") {
                    this.log(chalk.red(`Faucet: ${claim.data?.message || "Claim Failed"}`));
                    this.failedClaims++;
                } else {
                    this.log(chalk.red(`Faucet: Claim Failed | Response: ${JSON.stringify(lastError || claim)}`));
                    this.failedClaims++;
                }
            } else {
                const faucetAvailableTs = faucetStatus.data?.avaliable_timestamp;
                const faucetAvailableWib = new Date(faucetAvailableTs * 1000).toLocaleString('en-US', { timeZone: 'Asia/Jakarta' });
                this.log(chalk.yellow(`Faucet: Already Claimed - Available at: ${faucetAvailableWib}`));
                this.failedClaims++;
            }
        } else {
            this.log(chalk.red("Faucet: GET Eligibility Status Failed after 3 retries"));
            this.failedClaims++;
        }
    }

    async loginAndClaimFaucet() {
        if (!fs.existsSync('accounts.txt')) {
            this.log("No wallets found. Please generate wallets first.");
            return;
        }

        this.successfulClaims = 0;
        this.failedClaims = 0;

        const accounts = fs.readFileSync('accounts.txt', 'utf8').split('\n').filter(Boolean);
        this.log(`Total Accounts: ${accounts.length}`);

        for (const privateKey of accounts) {
            if (privateKey) {
                await this.processAccount(privateKey);
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }

        this.log("=".repeat(72));
        this.log(`Successful Claims: ${this.successfulClaims}`);
        this.log(`Failed Claims: ${this.failedClaims}`);
        this.log(`Total Processed: ${accounts.length}`);
    }

    async getBalance(address) {
        try {
            const balance = await this.provider.getBalance(address);
            return ethers.formatEther(balance);
        } catch (e) {
            if (e.message.includes("network")) {
                this.log("Network error. Please check your internet connection.");
            } else {
                this.log(`Error getting balance: ${e.message}`);
            }
            return "Error";
        }
    }

    async showAllBalances() {
        if (!fs.existsSync('accounts.txt')) {
            this.log("No wallets found. Please generate wallets first.");
            return;
        }

        const accounts = fs.readFileSync('accounts.txt', 'utf8').split('\n').filter(Boolean);
        this.log(`Total Accounts: ${accounts.length}`);
        this.log("=".repeat(72));

        // First check if we can connect to the network
        try {
            await this.provider.getNetwork();
        } catch (e) {
            this.log("Cannot connect to Pharos network. Please check your internet connection.");
            return;
        }

        for (const privateKey of accounts) {
            if (privateKey) {
                const address = this.generateAddress(privateKey);
                if (address) {
                    const balance = await this.getBalance(address);
                    this.log(`Address: ${this.maskAccount(address)} | Balance: ${balance} PHRS`);
                    // Add small delay between requests
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }
    }

    async transferFaucet() {
        if (!fs.existsSync('accounts.txt')) {
            this.log(chalk.red("No wallets found. Please generate wallets first."));
            return;
        }

        const accounts = fs.readFileSync('accounts.txt', 'utf8').split('\n').filter(Boolean);
        if (accounts.length < 2) {
            this.log(chalk.red("Need at least 2 wallets for transfer. Please generate more wallets."));
            return;
        }

        // Get destination wallet address from user
        const destAddress = await this.askQuestion(chalk.green("Enter destination wallet address -> "));
        if (!ethers.isAddress(destAddress)) {
            this.log(chalk.red("Invalid wallet address."));
            return;
        }

        // Show total balance before transfer
        this.log(chalk.yellow("Checking balances before transfer..."));
        let totalBalance = 0;
        for (const privateKey of accounts) {
            if (privateKey) {
                const address = this.generateAddress(privateKey);
                if (address) {
                    const balance = await this.getBalance(address);
                    if (balance !== "Error") {
                        totalBalance += parseFloat(balance);
                    }
                }
            }
        }
        this.log(chalk.yellow(`Total balance across all wallets: ${totalBalance} PHRS`));

        // Confirm transfer
        const confirm = await this.askQuestion(chalk.yellow(`Do you want to transfer all ${totalBalance} PHRS to ${destAddress}? (y/n) -> `));
        if (confirm.toLowerCase() === 'y') {
            // Implement transfer logic here
            this.log(chalk.green("Transfer logic not implemented yet."));
        } else {
            this.log(chalk.yellow("Transfer cancelled."));
        }
    }

    async claimFaucetInRange() {
        if (!fs.existsSync('accounts.txt')) {
            this.log("No wallets found. Please generate wallets first.");
            return;
        }

        const accounts = fs.readFileSync('accounts.txt', 'utf8').split('\n').filter(Boolean);
        this.log(`Total Wallets: ${accounts.length}`);

        // Get range from user
        const startIndex = parseInt(await this.askQuestion("Enter start wallet number (1-" + accounts.length + ") -> ")) - 1;
        const endIndex = parseInt(await this.askQuestion("Enter end wallet number (1-" + accounts.length + ") -> ")) - 1;

        if (startIndex < 0 || endIndex >= accounts.length || startIndex > endIndex) {
            this.log("Invalid range selected.");
            return;
        }

        this.successfulClaims = 0;
        this.failedClaims = 0;

        this.log(`Processing wallets from ${startIndex + 1} to ${endIndex + 1}`);
        this.log("=".repeat(72));

        let processedCount = 0;
        for (let i = startIndex; i <= endIndex; i++) {
            const privateKey = accounts[i];
            if (privateKey) {
                processedCount++;
                const address = this.generateAddress(privateKey);
                if (address) {
                    this.log(`Processing wallet: ${this.maskAccount(address)} [${processedCount}/${endIndex - startIndex + 1}]`);
                }
                await this.processAccount(privateKey);
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }

        this.log("=".repeat(72));
        this.log(`Successful Claims: ${this.successfulClaims}`);
        this.log(`Failed Claims: ${this.failedClaims}`);
        this.log(`Total Processed: ${endIndex - startIndex + 1}`);
    }

    async main() {
        try {
            this.clearTerminal();
            this.welcome();
            await this.showMenu();
        } catch (e) {
            this.log(`Error: ${e.message}`);
        }
    }
}

// Run the bot
const bot = new PharosTestnet();
bot.main().catch(console.error);
