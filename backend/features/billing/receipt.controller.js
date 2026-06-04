const Receipt = require('./receipt.service');

async function listReceipts(req, res) {
	try {
		const receipts = await Receipt.getReceipts();
		res.json(receipts);
	} catch (err) {
		console.error('listReceipts error:', err);
		res.status(500).json({ error: err.message });
	}
}

async function getReceipt(req, res) {
	try {
		const receipt = await Receipt.getReceiptDetails(req.params.id);
		if (!receipt) {
			return res.status(404).json({ error: 'Receipt not found' });
		}
		res.json(receipt);
	} catch (err) {
		console.error('getReceipt error:', err);
		res.status(500).json({ error: err.message });
	}
}

async function createReceipt(req, res) {
	try {
		const { invoiceId, walletTxId } = req.body;
		if (!invoiceId || !walletTxId) {
			return res.status(400).json({ error: 'invoiceId and walletTxId are required' });
		}
		const created = await Receipt.createReceipt({ invoiceId, walletTxId });
		res.status(201).json(created);
	} catch (err) {
		console.error('createReceipt error:', err);
		res.status(500).json({ error: err.message });
	}
}

async function deleteReceipt(req, res) {
	try {
		await Receipt.deleteReceipt(req.params.id);
		res.status(204).send();
	} catch (err) {
		console.error('deleteReceipt error:', err);
		res.status(500).json({ error: err.message });
	}
}

module.exports = {
	listReceipts,
	getReceipt,
	createReceipt,
	deleteReceipt,
};

async function getReceiptPdf(req, res) {
	const puppeteer = require('puppeteer-core');
	const id = req.params.id;
	try {
		const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:3000';
		const url = `${FRONTEND.replace(/\/$/, '')}/receipt/${encodeURIComponent(id)}?print=1`;

		// Determine executable path for system-installed Chromium (probe common locations)
		const fs = require('fs');
		const envPath = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH;
		const candidates = [];
		if (envPath) candidates.push(envPath);
		candidates.push('/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', '/usr/bin/chrome', '/snap/bin/chromium');
		let found = null;
		for (const p of candidates) {
			try {
				if (p && fs.existsSync(p)) { found = p; break; }
			} catch (e) {}
		}

		let browser = null;
		let remoteConnected = false;
		if (found) {
			const launchArgs = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'];
			const launchOptions = { args: launchArgs, executablePath: found };
			console.info('Launching Chromium at:', found);
			browser = await puppeteer.launch(launchOptions);
		} else {
			// Try connecting to a remote headless Chrome (DevTools) service at chrome:9222
			const axios = require('axios');
			const wsJsonUrl = process.env.PUPPETEER_WS_JSON_URL || 'http://chrome:9222/json/version';
			try {
				const r = await axios.get(wsJsonUrl, { timeout: 5000 });
				const wsUrl = r?.data?.webSocketDebuggerUrl;
				if (!wsUrl) throw new Error('no webSocketDebuggerUrl in /json/version');
				console.info('Connecting to remote Chrome WebSocket:', wsUrl);
				browser = await puppeteer.connect({ browserWSEndpoint: wsUrl });
				remoteConnected = true;
			} catch (err) {
				const tried = candidates.filter(Boolean).join(', ');
				console.error('No Chromium executable and remote connect failed:', err && err.message);
				return res.status(500).json({ error: 'Failed to generate PDF', detail: `Browser not found locally (tried: ${tried}) and remote connect failed: ${err && err.message}. Start a headless Chrome service at chrome:9222 or set PUPPETEER_EXECUTABLE_PATH / PUPPETEER_WS_JSON_URL.` });
			}
		}
		const page = await browser.newPage();
		await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 1 });
		await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
		const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '8mm', right: '8mm' } });
		await browser.close();

		res.setHeader('Content-Type', 'application/pdf');
		res.setHeader('Content-Disposition', `attachment; filename=receipt-${id}.pdf`);
		res.send(pdfBuffer);
	} catch (err) {
		console.error('getReceiptPdf error:', err);
		res.status(500).json({ error: 'Failed to generate PDF', detail: err.message });
	}
}

// attach to exports
module.exports.getReceiptPdf = getReceiptPdf;

