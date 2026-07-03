import puppeteer from 'puppeteer-core';
import { logger } from '../utils/logger.js';
import fs from 'fs/promises';

/**
 * BrowserAutomator
 * Provides headless browser automation using Puppeteer to interact with the active WebContainer preview.
 */
class BrowserAutomator {
    constructor() {
        this.browser = null;
        this.page = null;
    }

    async init() {
        if (this.browser) return;
        try {
            // Use Chrome executable path based on OS or rely on puppeteer to find it
            const executablePath = process.platform === 'win32' 
                ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
                : (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/usr/bin/google-chrome');
            
            this.browser = await puppeteer.launch({
                executablePath,
                headless: 'new',
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            this.page = await this.browser.newPage();
            await this.page.setViewport({ width: 1280, height: 800 });
            
            this.page.on('console', msg => logger.debug(`[Browser Console] ${msg.text()}`));
            this.page.on('pageerror', error => logger.error(`[Browser Error] ${error.message}`));
        } catch (err) {
            logger.warn(`Failed to initialize BrowserAutomator: ${err.message}. Ensure Chrome is installed.`);
        }
    }

    async goto(url) {
        await this.init();
        if (!this.page) return { error: 'Browser not initialized' };
        
        try {
            await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 10000 });
            return { success: true, url: this.page.url() };
        } catch (err) {
            return { error: `Failed to navigate: ${err.message}` };
        }
    }

    async click(selector) {
        await this.init();
        if (!this.page) return { error: 'Browser not initialized' };
        
        try {
            await this.page.waitForSelector(selector, { timeout: 5000 });
            await this.page.click(selector);
            return { success: true, message: `Clicked ${selector}` };
        } catch (err) {
            return { error: `Failed to click ${selector}: ${err.message}` };
        }
    }

    async type(selector, text) {
        await this.init();
        if (!this.page) return { error: 'Browser not initialized' };
        
        try {
            await this.page.waitForSelector(selector, { timeout: 5000 });
            await this.page.type(selector, text);
            return { success: true, message: `Typed in ${selector}` };
        } catch (err) {
            return { error: `Failed to type in ${selector}: ${err.message}` };
        }
    }

    async screenshot(path = './screenshot.png') {
        await this.init();
        if (!this.page) return { error: 'Browser not initialized' };
        
        try {
            await this.page.screenshot({ path });
            return { success: true, path };
        } catch (err) {
            return { error: `Failed to take screenshot: ${err.message}` };
        }
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
    }
}

export const browserAutomator = new BrowserAutomator();
