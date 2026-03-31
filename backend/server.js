const createApp = require('./app');
const app = createApp();

const PORT = Number(process.env.PORT) || 8000;
// run DB initialization for local/dev environments to handle schema drift
try {
	// log DATABASE_URL for debugging connection target
	try { console.log('DATABASE_URL=', process.env.DATABASE_URL); } catch(_) {}
	const {
		ensureBlockTransactionColumns,
		ensureCredIdColumn,
		ensureUserRoleDefault,
		ensureTransactionVerificationColumns,
		ensureWalletFloatColumns,
		ensureEnergyDecimalColumns,
	} = require('./utils/dbInit');
	ensureBlockTransactionColumns().catch(e => console.warn('ensureBlockTransactionColumns error', e && e.message ? e.message : e));
	ensureCredIdColumn().catch(e => console.warn('ensureCredIdColumn error', e && e.message ? e.message : e));
	ensureUserRoleDefault().catch(e => console.warn('ensureUserRoleDefault error', e && e.message ? e.message : e));
	ensureTransactionVerificationColumns().catch(e => console.warn('ensureTransactionVerificationColumns error', e && e.message ? e.message : e));
	ensureWalletFloatColumns().catch(e => console.warn('ensureWalletFloatColumns error', e && e.message ? e.message : e));
	ensureEnergyDecimalColumns().catch(e => console.warn('ensureEnergyDecimalColumns error', e && e.message ? e.message : e));
} catch (e) {
	console.warn('DB init module not available', e && e.message ? e.message : e);
}

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

