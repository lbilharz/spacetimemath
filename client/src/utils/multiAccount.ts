import { capturedToken } from '../auth.js';
import type { Player } from '../module_bindings/types.js';

export interface SavedAccount {
    identity: string;
    token: string;
    username: string;
    playerType: string;
    learningTier: number;
}

const ACCOUNTS_KEY = 'spacetimemath_accounts';
const CREDS_KEY = 'spacetimemath_credentials';

export function getSavedAccounts(): SavedAccount[] {
    try {
        const raw = localStorage.getItem(ACCOUNTS_KEY);
        if (raw) return JSON.parse(raw);
    } catch { /* corrupt localStorage — return empty */ }
    return [];
}

export function syncCurrentAccount(player: Player, myIdentityHex: string) {
    if (!capturedToken) return;
    if (!player.username || !player.username.trim() || !player.onboardingDone) return;

    const accounts = getSavedAccounts();
    const existingIdx = accounts.findIndex(a => a.identity === myIdentityHex);
    
    const account: SavedAccount = {
        identity: myIdentityHex,
        token: capturedToken,
        username: player.username,
        playerType: player.playerType.tag,
        learningTier: player.learningTier
    };
    
    if (existingIdx >= 0) {
        accounts[existingIdx] = account;
    } else {
        accounts.push(account);
    }
    
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

export function switchAccount(identity: string) {
    const accounts = getSavedAccounts();
    const target = accounts.find(a => a.identity === identity);
    if (target) {
        localStorage.setItem(CREDS_KEY, JSON.stringify({ identity: target.identity, token: target.token }));
        window.location.reload();
    }
}

export function addAccount() {
    localStorage.removeItem(CREDS_KEY);
    window.location.reload();
}

export function removeAccount(identity: string) {
    let accounts = getSavedAccounts();
    accounts = accounts.filter(a => a.identity !== identity);
    
    if (accounts.length === 0) {
        localStorage.removeItem(ACCOUNTS_KEY);
        localStorage.removeItem(CREDS_KEY);
        window.location.reload();
        return;
    }
    
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
    
    // If we removed the current account, fallback to the first available one
    try {
        const creds = JSON.parse(localStorage.getItem(CREDS_KEY) || '{}');
        if (creds.identity === identity) {
            switchAccount(accounts[0].identity);
        }
    } catch { /* corrupt credentials entry — skip fallback */ }
}
