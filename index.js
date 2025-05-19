const { ethers } = require('ethers');
const axios = require('axios');
const FakeUserAgent = require('fake-useragent');
const fs = require('fs');
const readline = require('readline');
const chalk = require('chalk').default;

const BASE_API = "https://api.pharosnetwork.xyz";
const REF_CODE = "PNFXEcz1CWezuu3g"; // You can change this to your ref code
const RPC_URL = "https://testnet.dplabs-internal.com"; // Updated Pharos testnet RPC

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
            chainId: 688688, // Correct Pharos testnet chain ID
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
                    timeout: 120000
                });
                return response.data.data.jwt;
            } catch (e) {
                if (attempt < 4) {
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    continue;
                }
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
                    timeout: 120000
                });
                return response.data;
            } catch (e) {
                if (attempt < 4) {
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    continue;
                }
                return null;
            }
        }
    }

    async claimFaucet(address, token) {
        const url = `${BASE_API}/faucet/daily?address=${address}`;
        const headers = {
            ...this.headers,
            "Authorization": `Bearer ${token}`,
            "Content-Length": "0"
        };

        for (let attempt = 0; attempt < 5; attempt++) {
            try {
                const response = await axios.post(url, null, {
                    headers,
                    timeout: 120000
                });
                return response.data;
            } catch (e) {
                if (e.response?.data) {
                    return e.response.data;
                }
                if (attempt < 4) {
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    continue;
                }
                return null;
            }
        }
    }

    async processAccount(privateKey) {
        const address = this.generateAddress(privateKey);
        if (!address) return;

        const urlLogin = await this.generateUrlLogin(privateKey, address);
        if (!urlLogin) return;

        this.log(`=========================[ ${this.maskAccount(address)} ]=========================`);

        // Login
        const token = await this.userLogin(urlLogin);
        if (!token) {
            this.log("Status: Login Failed");
            this.failedClaims++;
            return;
        }
        this.log("Status: Login Success");

        // Wait 2 seconds before claiming faucet
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Check Faucet Status
        const faucetStatus = await this.faucetStatus(address, token);
        if (faucetStatus?.msg === "ok") {
            const isAble = faucetStatus.data?.is_able_to_faucet;

            if (isAble) {
                const claim = await this.claimFaucet(address, token);
                if (claim?.msg === "ok") {
                    this.log("Faucet: 0.2 PHRS Claimed Successfully");
                    this.successfulClaims++;
                } else if (claim?.msg === "error") {
                    this.log(`Faucet: ${claim.data?.message || "Claim Failed"}`);
                    this.failedClaims++;
                } else {
                    this.log("Faucet: Claim Failed - Unknown Error");
                    this.failedClaims++;
                }
            } else {
                const faucetAvailableTs = faucetStatus.data?.avaliable_timestamp;
                const faucetAvailableWib = new Date(faucetAvailableTs * 1000).toLocaleString('en-US', { timeZone: 'Asia/Jakarta' });
                this.log(`Faucet: Already Claimed - Available at: ${faucetAvailableWib}`);
                this.failedClaims++;
            }
        } else {
            this.log("Faucet: GET Eligibility Status Failed");
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
            this.log("No wallets found. Please generate wallets first.");
            return;
        }

        const accounts = fs.readFileSync('accounts.txt', 'utf8').split('\n').filter(Boolean);
        if (accounts.length < 2) {
            this.log("Need at least 2 wallets for transfer. Please generate more wallets.");
            return;
        }

        // Show available wallets
        this.log("Available Wallets:");
        for (let i = 0; i < accounts.length; i++) {
            const address = this.generateAddress(accounts[i]);
            if (address) {
                const balance = await this.getBalance(address);
                this.log(`${i + 1}. ${this.maskAccount(address)} | Balance: ${balance} PHRS`);
            }
        }

        // Get source wallet
        const sourceIndex = parseInt(await this.askQuestion("\nSelect source wallet number -> ")) - 1;
        if (sourceIndex < 0 || sourceIndex >= accounts.length) {
            this.log("Invalid source wallet selection.");
            return;
        }

        // Get destination wallet
        const destIndex = parseInt(await this.askQuestion("Select destination wallet number -> ")) - 1;
        if (destIndex < 0 || destIndex >= accounts.length || destIndex === sourceIndex) {
            this.log("Invalid destination wallet selection.");
            return;
        }

        // Get amount
        const amount = await this.askQuestion("Enter amount to transfer (in PHRS) -> ");
        const amountWei = ethers.parseEther(amount);

        // Create wallet instance
        const sourceWallet = new ethers.Wallet(accounts[sourceIndex], this.provider);
        const destAddress = this.generateAddress(accounts[destIndex]);

        try {
            this.log("Sending transaction...");
            const tx = await sourceWallet.sendTransaction({
                to: destAddress,
                value: amountWei
            });
            this.log(`Transaction sent! Hash: ${tx.hash}`);
            await tx.wait();
            this.log("Transaction confirmed!");
        } catch (e) {
            this.log(`Transfer failed: ${e.message}`);
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
