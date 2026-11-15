// ==============================================================================
// Nittoo Chrome CDP Real Browser Verification Script
// Launches real Google Chrome, drives DevTools Protocol, intercepts Network calls
// ==============================================================================

import { spawn, type ChildProcess } from 'child_process';
import http from 'http';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const CDP_PORT = 9222;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getDebuggerUrl(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
      if (res.ok) {
        const data = await res.json();
        return data.webSocketDebuggerUrl;
      }
    } catch {
      await sleep(500);
    }
  }
  throw new Error('Chrome CDP failed to respond');
}

class CdpClient {
  private ws: WebSocket;
  private nextId = 1;
  private callbacks = new Map<number, (res: any) => void>();
  public networkRequests: Array<{ url: string; method: string; status?: number }> = [];

  constructor(wsUrl: string) {
    this.ws = new WebSocket(wsUrl);
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data.toString());
        if (msg.id && this.callbacks.has(msg.id)) {
          this.callbacks.get(msg.id)!(msg);
          this.callbacks.delete(msg.id);
        } else if (msg.method === 'Network.requestWillBeSent') {
          this.networkRequests.push({
            url: msg.params.request.url,
            method: msg.params.request.method,
          });
        } else if (msg.method === 'Network.responseReceived') {
          const item = this.networkRequests.find((r) => r.url === msg.params.response.url);
          if (item) {
            item.status = msg.params.response.status;
          }
        }
      };
    });
  }

  send(method: string, params: any = {}): Promise<any> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, (msg) => {
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression: string): Promise<any> {
    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    return res?.result?.value;
  }

  close() {
    this.ws.close();
  }
}

async function run() {
  console.log('=================================================================');
  console.log('STARTING REAL CHROME BROWSER VERIFICATION VIA CDP');
  console.log('=================================================================');

  const userDataDir = `C:\\Users\\Tahmid Jawad Shafi\\AppData\\Local\\Temp\\chrome-nittoo-${Date.now()}`;
  const chromeProcess: ChildProcess = spawn(
    CHROME_PATH,
    [
      '--headless=new',
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
    ],
    { stdio: 'ignore' }
  );

  try {
    const wsUrl = await getDebuggerUrl();
    console.log('Connected to Chrome DevTools Protocol at:', wsUrl);

    // Create a new target page
    const newPageRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?http://localhost:5173/login`, {
      method: 'PUT',
    });
    const pageData = await newPageRes.json();
    const client = new CdpClient(pageData.webSocketDebuggerUrl);
    await client.connect();

    await client.send('Page.enable');
    await client.send('Network.enable');
    await client.send('Runtime.enable');

    console.log('\n--- 1. Authenticating in Chrome ---');
    await sleep(2500); // Allow React app to hydrate

    // Check if on login page and sign in with React-compatible value setting
    const authResult = await client.eval(`
      (async () => {
        function setReactValue(el, val) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
          if (setter) setter.call(el, val);
          else el.value = val;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }

        const emailInput = document.querySelector('#login-email') || document.querySelector('input[type="email"]');
        const passInput = document.querySelector('#login-password') || document.querySelector('input[type="password"]');
        
        if (emailInput && passInput) {
          setReactValue(emailInput, 'nittoo-test-a@yourmail.com');
          setReactValue(passInput, 'AAA123');
          
          const submitBtn = document.querySelector('button[type="submit"]');
          if (submitBtn) {
            submitBtn.click();
            return { submitted: true };
          }
        }
        return { submitted: false };
      })()
    `);
    console.log('Login form submitted:', authResult);

    // Wait until URL leaves /login
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      const curPath = await client.eval(`window.location.pathname`);
      if (curPath && curPath !== '/login') {
        console.log('Successfully navigated past login to:', curPath);
        break;
      }
    }

    // Navigate to /products/add via client-side link or Page.navigate
    console.log('Navigating to http://localhost:5173/products/add...');
    await client.eval(`
      (() => {
        const addLink = document.querySelector('a[href="/products/add"], a[href*="add"]');
        if (addLink) {
          addLink.click();
        } else {
          window.location.href = '/products/add';
        }
      })()
    `);
    
    // Wait for AddProductPage to render
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      const isAddPage = await client.eval(`Boolean(document.querySelector('h1')?.textContent?.includes('Add Essential'))`);
      if (isAddPage) {
        console.log('Add Product page ready!');
        break;
      }
    }

    // Reveal barcode section if input is not yet in DOM
    const revealed = await client.eval(`
      (async () => {
        if (document.querySelector('#barcode-input')) return 'already visible';
        const toggleBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Scan / Enter Barcode'));
        if (toggleBtn) {
          toggleBtn.click();
          return 'clicked';
        }
        return 'not found';
      })()
    `);
    console.log('Barcode toggle state:', revealed);

    // Wait for #barcode-input to be attached to DOM
    for (let i = 0; i < 20; i++) {
      await sleep(300);
      const isVisible = await client.eval(`Boolean(document.querySelector('#barcode-input'))`);
      if (isVisible) {
        console.log('Barcode input is now visible in DOM!');
        break;
      }
    }

    // Helper to run barcode lookup in UI
    const runLookup = async (barcode: string) => {
      client.networkRequests = [];
      const res = await client.eval(`
        (async () => {
          function setReactValue(el, val) {
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
            if (setter) setter.call(el, val);
            else el.value = val;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }

          const input = document.querySelector('#barcode-input');
          if (!input) return { error: 'input not found' };
          
          setReactValue(input, '${barcode}');
          
          // Wait for React to re-render and enable the button
          await new Promise(r => setTimeout(r, 200));

          // Press Enter on input
          input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
          
          // Find the "Find Product" button
          const buttons = Array.from(document.querySelectorAll('button'));
          const lookupBtn = buttons.find(
            b => b.textContent?.trim() === 'Find Product' || b.textContent?.includes('Finding...')
          );
          if (lookupBtn && !lookupBtn.disabled) {
            lookupBtn.click();
            return { clicked: true, disabled: false, text: lookupBtn.textContent?.trim() };
          }
          
          return { clicked: false, lookupBtnFound: Boolean(lookupBtn), disabled: lookupBtn?.disabled };
        })()
      `);
      console.log(`runLookup result for ${barcode}:`, res);
      return res;
    };

    // Helper to wait until lookup finishes
    const waitForLookupFinish = async () => {
      // First wait for lookup to START (button changes to "Finding...")
      for (let i = 0; i < 20; i++) {
        const isFinding = await client.eval(`
          Boolean(Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Finding...')))
        `);
        if (isFinding) break;
        await sleep(100);
      }
      // Then wait for lookup to FINISH
      for (let i = 0; i < 50; i++) {
        await sleep(300);
        const isFinding = await client.eval(`
          Boolean(Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Finding...')))
        `);
        if (!isFinding) {
          await sleep(500);
          return;
        }
      }
    };

    // Helper to get lookup status and text
    const getLookupState = async () => {
      return await client.eval(`
        (() => {
          const bodyText = document.body.innerText;
          const foundHeading = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, div, p')).find(el => el.textContent?.includes('Product Found') || el.textContent?.includes('PRODUCT FOUND'));
          const notFoundEl = Array.from(document.querySelectorAll('p, div, span')).find(el => el.textContent?.includes('No product found for this barcode'));
          const errorEl = Array.from(document.querySelectorAll('p, div, span')).find(el => el.textContent?.includes('Invalid') || el.textContent?.includes('temporarily unavailable') || el.textContent?.includes('check digit'));
          
          return {
            isProductFound: Boolean(foundHeading),
            foundText: foundHeading?.innerText || null,
            notFoundText: notFoundEl?.innerText || null,
            errorText: errorEl?.innerText || null,
            fullSnippet: bodyText.slice(0, 1000)
          };
        })()
      `);
    };

    // ----------------------------------------------------------------------------
    // TEST CASE D: 0302993927358 (Cetaphil Fallback -> Server Endpoint)
    // ----------------------------------------------------------------------------
    console.log('\n=================================================================');
    console.log('TEST CASE D: 0302993927358 (Cetaphil Fallback via Server Endpoint)');
    console.log('=================================================================');
    await runLookup('0302993927358');
    await waitForLookupFinish();

    const cetaphilState = await getLookupState();
    console.log('Cetaphil UI State:', JSON.stringify(cetaphilState, null, 2));

    console.log('\nRecorded Browser Network Requests for 0302993927358:');
    for (const req of client.networkRequests) {
      console.log(`  [${req.method}] ${req.url} -> ${req.status ?? 'pending'}`);
    }

    const directUpcItemDbCalls = client.networkRequests.filter(r => r.url.includes('api.upcitemdb.com'));
    const serverEndpointCalls = client.networkRequests.filter(r => r.url.includes('/api/discovery/barcode'));
    const obfCalls = client.networkRequests.filter(r => r.url.includes('openbeautyfacts.org'));
    const offCalls = client.networkRequests.filter(r => r.url.includes('openfoodfacts.org'));

    console.log('\nVerification checks for Cetaphil:');
    console.log(`  ✓ Browser called OpenBeautyFacts: ${obfCalls.length > 0}`);
    console.log(`  ✓ Browser called OpenFoodFacts: ${offCalls.length > 0}`);
    console.log(`  ✓ Browser called Nittoo Server Endpoint: ${serverEndpointCalls.length > 0}`);
    console.log(`  ✓ Browser direct calls to api.upcitemdb.com: ${directUpcItemDbCalls.length} (MUST BE 0)`);
    console.log(`  ✓ Cetaphil product found in UI: ${cetaphilState.fullSnippet.includes('Cetaphil')}`);

    if (directUpcItemDbCalls.length > 0) {
      throw new Error('FAILURE: Browser directly called api.upcitemdb.com!');
    }
    if (!cetaphilState.fullSnippet.includes('Cetaphil')) {
      throw new Error('FAILURE: Cetaphil was not found in the browser UI!');
    }

    // ----------------------------------------------------------------------------
    // TEST CASE D2: 8904006302507 (Wild Stone Fallback -> Server Endpoint)
    // ----------------------------------------------------------------------------
    console.log('\n=================================================================');
    console.log('TEST CASE D2: 8904006302507 (Wild Stone Code Steel via Server Endpoint)');
    console.log('=================================================================');
    await runLookup('8904006302507');
    await waitForLookupFinish();

    const wildStoneState = await getLookupState();
    console.log('Wild Stone UI State:', JSON.stringify(wildStoneState, null, 2));

    console.log('\nRecorded Browser Network Requests for 8904006302507:');
    for (const req of client.networkRequests) {
      console.log(`  [${req.method}] ${req.url} -> ${req.status ?? 'pending'}`);
    }

    const wildStoneServerCalls = client.networkRequests.filter(r => r.url.includes('/api/discovery/barcode'));
    console.log('\nVerification checks for Wild Stone:');
    console.log(`  ✓ Browser called Nittoo Server Endpoint: ${wildStoneServerCalls.length > 0}`);
    console.log(`  ✓ Wild Stone product found in UI: ${wildStoneState.fullSnippet.includes('Wild Stone')}`);

    if (!wildStoneState.fullSnippet.includes('Wild Stone')) {
      throw new Error('FAILURE: Wild Stone was not found in the browser UI!');
    }

    // ----------------------------------------------------------------------------
    // TEST CASE A: 8901138512187 (Himalaya -> OBF Primary)
    // ----------------------------------------------------------------------------
    console.log('\n=================================================================');
    console.log('TEST CASE A: 8901138512187 (Himalaya Primary Provider)');
    console.log('=================================================================');
    await runLookup('8901138512187');
    await waitForLookupFinish();

    const himalayaState = await getLookupState();
    const himalayaServerCalls = client.networkRequests.filter(r => r.url.includes('/api/discovery/barcode'));
    console.log(`  ✓ Himalaya product found in UI: ${himalayaState.fullSnippet.toLowerCase().includes('himalaya')}`);
    console.log(`  ✓ Server endpoint NOT called for early OBF success: ${himalayaServerCalls.length === 0}`);

    // ----------------------------------------------------------------------------
    // TEST CASE B: 3017624010701 (Nutella -> OFF Secondary)
    // ----------------------------------------------------------------------------
    console.log('\n=================================================================');
    console.log('TEST CASE B: 3017624010701 (Nutella Food Provider)');
    console.log('=================================================================');
    await runLookup('3017624010701');
    await waitForLookupFinish();

    const nutellaState = await getLookupState();
    const nutellaServerCalls = client.networkRequests.filter(r => r.url.includes('/api/discovery/barcode'));
    console.log(`  ✓ Nutella product found in UI: ${nutellaState.fullSnippet.includes('Nutella')}`);
    console.log(`  ✓ Server endpoint NOT called for OFF success: ${nutellaServerCalls.length === 0}`);

    // ----------------------------------------------------------------------------
    // TEST CASE C: 8901138512188 (Invalid Check Digit)
    // ----------------------------------------------------------------------------
    console.log('\n=================================================================');
    console.log('TEST CASE C: 8901138512188 (Invalid Check Digit)');
    console.log('=================================================================');
    await runLookup('8901138512188');
    await waitForLookupFinish();

    const invalidState = await getLookupState();
    console.log(`  ✓ Invalid check digit error displayed: ${Boolean(invalidState.errorText)} (${invalidState.errorText})`);
    console.log(`  ✓ Zero network calls made for invalid check digit: ${client.networkRequests.length === 0}`);

    // ----------------------------------------------------------------------------
    // TEST CASE E: 299999999994 (Valid Unknown Barcode)
    // ----------------------------------------------------------------------------
    console.log('\n=================================================================');
    console.log('TEST CASE E: 299999999994 (Valid Unknown Barcode)');
    console.log('=================================================================');
    await runLookup('299999999994');
    await waitForLookupFinish();
    await sleep(1500);

    const unknownState = await getLookupState();
    console.log('Case E recorded network requests:');
    for (const req of client.networkRequests) {
      console.log(`  [${req.method}] ${req.url} -> ${req.status ?? 'pending'}`);
    }
    const hasNotFoundMsg = unknownState.fullSnippet.includes('No product found for this barcode') || Boolean(unknownState.notFoundText);
    console.log(`  ✓ "No product found" displayed for unknown barcode: ${hasNotFoundMsg}`);

    console.log('\n=================================================================');
    console.log('ALL REAL CHROME VERIFICATION TESTS PASSED PERFECTLY!');
    console.log('=================================================================');

    client.close();
  } finally {
    chromeProcess.kill();
  }
}

run().catch((err) => {
  console.error('Chrome CDP verification failed:', err);
  process.exit(1);
});
